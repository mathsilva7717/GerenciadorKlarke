# ============================================================
#  KLARKE REPAIR - utilitario portable (CPU-Z + CCleaner)
#  Servidor HTTP local (TcpListener) + UI moderna no navegador.
#  Sem .exe, sem dependencias. Roda como Usuario ou Admin.
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'
[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ------------------------------------------------------------
# Estado / Admin
# ------------------------------------------------------------
function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}
$Script:IsAdmin = Test-Admin
$Script:Jobs = @{}
# Codepage OEM do console (ex.: 850 no PT-BR) p/ decodificar saida de cmd/ping/sfc
$Script:OEMEnc = try { [System.Text.Encoding]::GetEncoding(([System.Globalization.CultureInfo]::CurrentCulture).TextInfo.OEMCodePage) } catch { [System.Text.Encoding]::Default }

# ------------------------------------------------------------
# Coleta de Hardware (estilo CPU-Z) via CIM
# ------------------------------------------------------------
function Get-MemTypeName($code) {
  switch ([int]$code) {
    20 {'DDR'} 21 {'DDR2'} 24 {'DDR3'} 26 {'DDR4'} 34 {'DDR5'}
    default {'—'}
  }
}

function Get-SysInfo {
  $os  = Get-CimInstance Win32_OperatingSystem
  $cs  = Get-CimInstance Win32_ComputerSystem
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $bb  = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
  $bios= Get-CimInstance Win32_BIOS | Select-Object -First 1
  $mem = @(Get-CimInstance Win32_PhysicalMemory)
  $gpu = @(Get-CimInstance Win32_VideoController)
  $disk= @(Get-CimInstance Win32_DiskDrive)
  $net = @(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=true")

  $uptime = ((Get-Date) - $os.LastBootUpTime).TotalSeconds

  $memMods = foreach ($m in $mem) {
    [ordered]@{
      bank   = "$($m.DeviceLocator)"
      size   = [int64]$m.Capacity
      type   = Get-MemTypeName $m.SMBIOSMemoryType
      speed  = [int]$m.Speed
      maker  = ("$($m.Manufacturer)").Trim()
      part   = ("$($m.PartNumber)").Trim()
      volt   = if ($m.ConfiguredVoltage) { [math]::Round($m.ConfiguredVoltage/1000,2) } else { 0 }
    }
  }
  $gpus = foreach ($g in $gpu) {
    [ordered]@{
      model  = "$($g.Name)"
      vram   = if ($g.AdapterRAM -gt 0) { [int64]$g.AdapterRAM } else { 0 }
      driver = "$($g.DriverVersion)"
      proc   = "$($g.VideoProcessor)"
    }
  }
  $disks = foreach ($d in $disk) {
    [ordered]@{
      model = "$($d.Model)"
      size  = [int64]$d.Size
      iface = "$($d.InterfaceType)"
      media = "$($d.MediaType)"
      serial= ("$($d.SerialNumber)").Trim()
    }
  }
  $nets = foreach ($n in $net) {
    [ordered]@{
      desc = "$($n.Description)"
      ip   = @($n.IPAddress | Where-Object { $_ -notmatch ':' })[0]
      mask = @($n.IPSubnet)[0]
      mac  = "$($n.MACAddress)"
      gw   = @($n.DefaultIPGateway)[0]
      dhcp = [bool]$n.DHCPEnabled
    }
  }

  [ordered]@{
    os = [ordered]@{
      caption = "$($os.Caption)"
      version = "$($os.Version)"
      build   = "$($os.BuildNumber)"
      arch    = "$($os.OSArchitecture)"
      hostname= "$($os.CSName)"
      uptime  = [int64]$uptime
    }
    system = [ordered]@{
      maker = ("$($cs.Manufacturer)").Trim()
      model = ("$($cs.Model)").Trim()
      ram   = [int64]$cs.TotalPhysicalMemory
    }
    cpu = [ordered]@{
      name    = ("$($cpu.Name)").Trim()
      maker   = "$($cpu.Manufacturer)"
      cores   = [int]$cpu.NumberOfCores
      threads = [int]$cpu.NumberOfLogicalProcessors
      maxClk  = [int]$cpu.MaxClockSpeed
      curClk  = [int]$cpu.CurrentClockSpeed
      l2      = [int]$cpu.L2CacheSize
      l3      = [int]$cpu.L3CacheSize
      socket  = "$($cpu.SocketDesignation)"
      bits    = [int]$cpu.AddressWidth
      virt    = [bool]$cpu.VirtualizationFirmwareEnabled
    }
    board = [ordered]@{
      maker = ("$($bb.Manufacturer)").Trim()
      model = ("$($bb.Product)").Trim()
      ver   = ("$($bb.Version)").Trim()
      serial= ("$($bb.SerialNumber)").Trim()
    }
    bios = [ordered]@{
      maker = ("$($bios.Manufacturer)").Trim()
      ver   = "$($bios.SMBIOSBIOSVersion)"
      date  = if ($bios.ReleaseDate) { $bios.ReleaseDate.ToString('yyyy-MM-dd') } else { '—' }
    }
    mem = @($memMods)
    gpu = @($gpus)
    disk= @($disks)
    net = @($nets)
    admin = $Script:IsAdmin
  }
}

function Get-Live {
  $os = Get-CimInstance Win32_OperatingSystem
  $load = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  $c = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
  $temp = $null
  try {
    $t = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1
    if ($t) { $temp = [math]::Round(($t.CurrentTemperature / 10) - 273.15, 0) }
  } catch {}
  $totalMem = [int64]$os.TotalVisibleMemorySize * 1024
  $freeMem  = [int64]$os.FreePhysicalMemory * 1024
  [ordered]@{
    cpu     = [int]$load
    temp    = $temp
    memUsed = $totalMem - $freeMem
    memTotal= $totalMem
    diskUsed= [int64]$c.Size - [int64]$c.FreeSpace
    diskTotal=[int64]$c.Size
    diskFree= [int64]$c.FreeSpace
    uptime  = [int64]((Get-Date) - $os.LastBootUpTime).TotalSeconds
    admin   = $Script:IsAdmin
  }
}

# ------------------------------------------------------------
# Limpeza (estilo CCleaner)
# ------------------------------------------------------------
function Get-CleanupCategories {
  $local = $env:LOCALAPPDATA
  @(
    @{ id='user_temp'; label='Temporarios do Usuario'; desc='Pasta TEMP do usuario atual'; paths=@($env:TEMP) }
    @{ id='win_temp';  label='Temporarios do Windows'; desc='C:\Windows\Temp'; paths=@('C:\Windows\Temp') }
    @{ id='prefetch';  label='Cache Prefetch'; desc='Dados de pre-carregamento de apps'; paths=@('C:\Windows\Prefetch') }
    @{ id='win_update';label='Cache do Windows Update'; desc='Downloads pendentes/corrompidos'; paths=@('C:\Windows\SoftwareDistribution\Download') }
    @{ id='crash';     label='Relatorios de Erro / Dumps'; desc='WER e despejos de memoria'; paths=@("$local\CrashDumps","$local\Microsoft\Windows\WER") }
    @{ id='chrome';    label='Cache do Google Chrome'; desc='Arquivos temporarios de navegacao'; paths=@("$local\Google\Chrome\User Data\Default\Cache") }
    @{ id='edge';      label='Cache do Microsoft Edge'; desc='Arquivos temporarios de navegacao'; paths=@("$local\Microsoft\Edge\User Data\Default\Cache") }
  )
}

function Get-PathSize($p) {
  if (-not (Test-Path -LiteralPath $p)) { return @{ bytes=0; files=0 } }
  $sum = Get-ChildItem -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
  @{ bytes=[int64]($sum.Sum); files=[int]($sum.Count) }
}

function Get-CleanupScan {
  $out = foreach ($c in Get-CleanupCategories) {
    $b = 0; $f = 0
    foreach ($p in $c.paths) { $r = Get-PathSize $p; $b += $r.bytes; $f += $r.files }
    [ordered]@{ id=$c.id; label=$c.label; desc=$c.desc; bytes=$b; files=$f; available=($f -gt 0) }
  }
  ,@($out)
}

# ------------------------------------------------------------
# Jobs com streaming para arquivo de log (poll do navegador).
# Usa Start-Process (filho redirecionado p/ arquivo), nao Start-Job:
# mais leve e nao interfere no loop do servidor.
# ------------------------------------------------------------
function New-JobId { [guid]::NewGuid().ToString('N').Substring(0, 8) }

function Start-CmdJob($command, $label) {
  $id = New-JobId
  $log = Join-Path $env:TEMP "klarke_$id.log"
  $bat = Join-Path $env:TEMP "klarke_$id.bat"
  Set-Content -LiteralPath $bat -Value "@echo off`r`n$command" -Encoding Default
  Set-Content -LiteralPath $log -Value '' -Encoding UTF8
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $bat) `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -NoNewWindow -PassThru
  $Script:Jobs[$id] = @{ Proc = $p; Log = $log; Label = $label }
  $id
}

function Start-CleanupJob($ids) {
  $id = New-JobId
  $log = Join-Path $env:TEMP "klarke_$id.log"
  Set-Content -LiteralPath $log -Value '' -Encoding UTF8
  $cats = Get-CleanupCategories | Where-Object { $ids -contains $_.id }
  $doRecycle = ($ids -contains 'recycle_bin')

  $blocks = New-Object System.Text.StringBuilder
  foreach ($cat in $cats) {
    $lbl = ($cat.label -replace "'", "''")
    [void]$blocks.AppendLine("Write-Output 'Limpando: $lbl'")
    foreach ($p in $cat.paths) {
      $pe = ($p -replace "'", "''")
      [void]$blocks.AppendLine("Klarke-Clean '$pe'")
    }
  }
  $recycleLine = if ($doRecycle) { "Write-Output 'Esvaziando Lixeira...'; Clear-RecycleBin -Force -ErrorAction SilentlyContinue" } else { '' }

  $tpl = @'
$ErrorActionPreference = 'SilentlyContinue'
$global:tb = 0; $global:tf = 0; $global:fl = 0
function Klarke-Clean($p) {
  if (-not (Test-Path -LiteralPath $p)) { return }
  Get-ChildItem -LiteralPath $p -Force | ForEach-Object {
    try {
      $s = (Get-ChildItem -LiteralPath $_.FullName -Recurse -Force | Measure-Object -Property Length -Sum).Sum
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop
      $global:tb += [int64]$s; $global:tf++
    } catch { $global:fl++ }
  }
}
__BLOCKS__
__RECYCLE__
$mb = [math]::Round($global:tb / 1MB, 1)
Write-Output "[OK] Limpeza concluida. $($global:tf) itens removidos. $mb MB liberados."
if ($global:fl -gt 0) { Write-Output "NOTA: $($global:fl) itens estavam em uso e foram ignorados." }
'@
  $script = $tpl.Replace('__BLOCKS__', $blocks.ToString().TrimEnd()).Replace('__RECYCLE__', $recycleLine)
  $ps1 = Join-Path $env:TEMP "klarke_$id.ps1"
  Set-Content -LiteralPath $ps1 -Value $script -Encoding UTF8
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ps1) `
    -RedirectStandardOutput $log -RedirectStandardError "$log.err" -NoNewWindow -PassThru
  $Script:Jobs[$id] = @{ Proc = $p; Log = $log; Label = 'Limpeza' }
  $id
}

function Get-JobLog($id) {
  if (-not $Script:Jobs.ContainsKey($id)) { return @{ text=''; done=$true } }
  $info = $Script:Jobs[$id]
  $out = ''
  try { if (Test-Path -LiteralPath $info.Log) { $out = [System.IO.File]::ReadAllText($info.Log, $Script:OEMEnc) } } catch {}
  try { if (Test-Path -LiteralPath "$($info.Log).err") { $err = [System.IO.File]::ReadAllText("$($info.Log).err", $Script:OEMEnc); if ($err) { $out = ($out.TrimEnd() + "`r`n" + $err) } } } catch {}
  $done = $info.Proc.HasExited
  $text = "--- Iniciando: $($info.Label) ---`r`n" + $out
  if ($done -and $info.Label -ne 'Limpeza') {
    $code = try { $info.Proc.ExitCode } catch { $null }
    $suffix = if ($null -ne $code) { " (codigo $code)" } else { '' }
    $text = $text.TrimEnd() + "`r`n[OK] $($info.Label) finalizado$suffix."
  }
  @{ text=$text; done=$done }
}

# ------------------------------------------------------------
# Servidor HTTP via HttpListener (http.sys). Em 127.0.0.1 nao exige
# admin/urlacl, gerencia conexoes (preconnect nao bloqueia) e e robusto.
# ------------------------------------------------------------
function Send-Bytes($ctx, $contentType, $bytes, $status = 200) {
  $resp = $ctx.Response
  $resp.StatusCode = $status
  $resp.ContentType = $contentType
  $resp.Headers['Cache-Control'] = 'no-store'
  $resp.ContentLength64 = $bytes.Length
  if ($bytes.Length -gt 0) { $resp.OutputStream.Write($bytes, 0, $bytes.Length) }
  $resp.OutputStream.Close()
}
function Send-Json($ctx, $obj) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  Send-Bytes $ctx 'application/json; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes($json))
}
function Read-Body($ctx) {
  if (-not $ctx.Request.HasEntityBody) { return '' }
  $reader = New-Object System.IO.StreamReader($ctx.Request.InputStream, $ctx.Request.ContentEncoding)
  $body = $reader.ReadToEnd(); $reader.Close(); $body
}

# ------------------------------------------------------------
# HTML / CSS / JS (arquivo ao lado, ASCII puro, real Chromium no browser)
# ------------------------------------------------------------
$HTML = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'app.html') -ErrorAction SilentlyContinue
if (-not $HTML) { $HTML = '<h1>app.html nao encontrado</h1>' }
$HTMLBytes = [System.Text.Encoding]::UTF8.GetBytes($HTML)

# ------------------------------------------------------------
# Loop principal
# ------------------------------------------------------------
$listener = New-Object System.Net.HttpListener
$port = 0
foreach ($p in 8765..8795) {
  try {
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add("http://127.0.0.1:$p/")
    $listener.Start()
    $port = $p; break
  } catch { try { $listener.Close() } catch {}; $listener = New-Object System.Net.HttpListener }
}
if ($port -eq 0) { Write-Host "  ERRO: nenhuma porta local disponivel."; exit 1 }

$url = "http://127.0.0.1:$port/"
Write-Host "  Klarke Repair rodando em $url"
Write-Host ("  Privilegios: " + $(if ($Script:IsAdmin) { 'ADMINISTRADOR' } else { 'Usuario padrao' }))
Write-Host ""
Start-Process $url | Out-Null

$running = $true
while ($running) {
  $ctx = $listener.GetContext()
  try {
    $path = $ctx.Request.Url.AbsolutePath
    $q = $ctx.Request.QueryString

    switch -Wildcard ($path) {
      '/' { Send-Bytes $ctx 'text/html; charset=utf-8' $HTMLBytes }
      '/favicon.ico' { Send-Bytes $ctx 'image/x-icon' ([byte[]]@()) 204 }
      '/api/sysinfo' { Send-Json $ctx (Get-SysInfo) }
      '/api/live' { Send-Json $ctx (Get-Live) }
      '/api/admin' { Send-Json $ctx @{ admin = $Script:IsAdmin } }
      '/api/cleanup/scan' { Send-Json $ctx (Get-CleanupScan) }
      '/api/cleanup' {
        $b = (Read-Body $ctx) | ConvertFrom-Json
        Send-Json $ctx @{ id = (Start-CleanupJob @($b.ids)) }
      }
      '/api/job' {
        $b = (Read-Body $ctx) | ConvertFrom-Json
        Send-Json $ctx @{ id = (Start-CmdJob $b.command $b.label) }
      }
      '/api/job/log' { Send-Json $ctx (Get-JobLog $q['id']) }
      '/api/tool' {
        $b = (Read-Body $ctx) | ConvertFrom-Json
        try { Start-Process -FilePath 'cmd.exe' -ArgumentList "/c $($b.command)" -WindowStyle Hidden | Out-Null; Send-Json $ctx @{ ok = $true } }
        catch { Send-Json $ctx @{ ok = $false; error = "$_" } }
      }
      '/api/elevate' {
        Send-Json $ctx @{ ok = $true }
        try { Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"" } catch {}
        $running = $false
      }
      '/api/quit' { Send-Json $ctx @{ ok = $true }; $running = $false }
      default { Send-Bytes $ctx 'text/plain' ([System.Text.Encoding]::UTF8.GetBytes('404')) 404 }
    }
  } catch {
    try { Send-Bytes $ctx 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes("Erro: $_")) 500 } catch {}
  }
}

try { $listener.Stop() } catch {}
Write-Host "  Servidor encerrado."
