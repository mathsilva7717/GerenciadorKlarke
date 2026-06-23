import os
import sys
import uuid
import ctypes
import socket
import shutil
import winreg
import platform
import threading
import subprocess
from datetime import datetime, timedelta
import tkinter as tk
import customtkinter as ctk

# Configure CustomTkinter
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

# Theme Colors (Dark / Cyan & Royal Blue Palette)
BG_COLOR = "#08080a"
TOPBAR_BG = "#0f1015"
CARD_BG = "#14151c"
ACCENT_CYAN = "#00d1ff"
ACCENT_ROYAL = "#1a53ff"
TEXT_PRIMARY = "#ffffff"
TEXT_SECONDARY = "#8c8c9c"
COLOR_SUCCESS = "#00e676"
COLOR_ERROR = "#ff3b30"
COLOR_WARNING = "#ffcc00"

class KlarkeRepairTool(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Window Settings
        self.title("Klarke System Utility & Repair")
        self.geometry("1024x768")
        self.minsize(960, 650)
        self.configure(fg_color=BG_COLOR)
        
        # Custom Icon
        try:
            self.iconbitmap(self.resource_path("icon.ico"))
        except:
            pass

        # State Variables
        self.is_running_task = False
        self.current_page = None
        
        # Check Admin Privileges
        self.is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0

        # Setup GUI Grid (2 Rows: Topbar and Main Content)
        self.grid_rowconfigure(0, weight=0) # Topbar
        self.grid_rowconfigure(1, weight=1) # Main Content
        self.grid_columnconfigure(0, weight=1)

        # Create Layout Elements
        self.create_topbar()
        self.create_main_container()
        
        # Default Page
        self.show_page("dashboard")

    # ==========================================
    # CORE GUI GENERATION
    # ==========================================

    def create_topbar(self):
        # Topbar Frame
        self.topbar_frame = ctk.CTkFrame(self, height=65, corner_radius=0, fg_color=TOPBAR_BG, border_width=0)
        self.topbar_frame.grid(row=0, column=0, sticky="ew")
        self.topbar_frame.grid_columnconfigure(1, weight=1) # Spacer between brand and nav

        # Brand Title (Left)
        brand_container = ctk.CTkFrame(self.topbar_frame, fg_color="transparent")
        brand_container.grid(row=0, column=0, padx=25, pady=10, sticky="w")

        self.brand_label = ctk.CTkLabel(
            brand_container, 
            text="KLARKE UTILS", 
            font=ctk.CTkFont(family="Segoe UI", size=22, weight="bold"),
            text_color=ACCENT_CYAN
        )
        self.brand_label.grid(row=0, column=0, sticky="w")

        self.subtitle_label = ctk.CTkLabel(
            brand_container, 
            text="System & Repair", 
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
            text_color=ACCENT_ROYAL
        )
        self.subtitle_label.grid(row=1, column=0, sticky="w", pady=(0, 2))

        # Navigation Menu (Center)
        self.nav_container = ctk.CTkFrame(self.topbar_frame, fg_color="transparent")
        self.nav_container.grid(row=0, column=1, sticky="nsw", padx=20)
        self.nav_container.grid_rowconfigure(0, weight=1)

        self.nav_buttons = {}
        nav_items = [
            ("dashboard", "Painel Principal"),
            ("system", "Sistema"),
            ("network", "Rede"),
            ("cleanup", "Otimização"),
            ("shortcuts", "Atalhos")
        ]

        col_index = 0
        for page_id, text in nav_items:
            btn = ctk.CTkButton(
                self.nav_container,
                text=text,
                fg_color="transparent",
                text_color=TEXT_PRIMARY,
                hover_color=CARD_BG,
                font=ctk.CTkFont(family="Segoe UI", size=14, weight="bold"),
                height=45,
                corner_radius=8,
                command=lambda p=page_id: self.show_page(p)
            )
            btn.grid(row=0, column=col_index, padx=8, pady=10)
            self.nav_buttons[page_id] = btn
            col_index += 1

        # Admin Status Badge & Elevation (Right)
        right_container = ctk.CTkFrame(self.topbar_frame, fg_color="transparent")
        right_container.grid(row=0, column=2, padx=20, pady=10, sticky="e")

        admin_text = "ADMINISTRADOR" if self.is_admin else "USUÁRIO"
        admin_color = COLOR_SUCCESS if self.is_admin else COLOR_WARNING
        
        self.status_badge = ctk.CTkLabel(
            right_container,
            text=admin_text,
            fg_color=admin_color,
            text_color="#000000",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            corner_radius=4,
            height=26,
            width=110
        )
        self.status_badge.grid(row=0, column=0, padx=10)

        if not self.is_admin:
            self.elevate_btn = ctk.CTkButton(
                right_container,
                text="Elevar Privilégio",
                fg_color=ACCENT_ROYAL,
                hover_color=ACCENT_CYAN,
                text_color=TEXT_PRIMARY,
                font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
                height=26,
                width=110,
                corner_radius=4,
                command=self.request_elevation
            )
            self.elevate_btn.grid(row=0, column=1)

        # Bottom Border for Topbar
        border = ctk.CTkFrame(self, height=2, fg_color=ACCENT_ROYAL, corner_radius=0)
        border.grid(row=1, column=0, sticky="ew")
        
        # Adjust main content to row 2
        self.grid_rowconfigure(2, weight=1)

    def create_main_container(self):
        # Main work area (bottom)
        self.main_container = ctk.CTkFrame(self, fg_color="transparent", corner_radius=0)
        self.main_container.grid(row=2, column=0, sticky="nsew", padx=35, pady=25)
        
        # Grid inside main container: top for pages (weight 3), bottom for logs console (weight 2)
        self.main_container.grid_rowconfigure(0, weight=5)
        self.main_container.grid_rowconfigure(1, weight=3)
        self.main_container.grid_columnconfigure(0, weight=1)

        # Pages Container (Upper part)
        self.pages_frame = ctk.CTkScrollableFrame(self.main_container, fg_color="transparent", border_width=0)
        self.pages_frame.grid(row=0, column=0, sticky="nsew")

        # Logs Console Container (Lower part)
        self.create_console()

    def create_console(self):
        self.console_frame = ctk.CTkFrame(self.main_container, fg_color=CARD_BG, corner_radius=12, border_color="#1d1e26", border_width=1)
        self.console_frame.grid(row=1, column=0, sticky="nsew", pady=(25, 0))
        self.console_frame.grid_rowconfigure(1, weight=1)
        self.console_frame.grid_columnconfigure(0, weight=1)

        # Header Console
        self.console_header = ctk.CTkFrame(self.console_frame, fg_color="transparent", height=30)
        self.console_header.grid(row=0, column=0, sticky="ew", padx=20, pady=10)
        self.console_header.grid_columnconfigure(0, weight=1)

        self.console_title = ctk.CTkLabel(
            self.console_header,
            text="Terminal de Atividades",
            font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
            text_color=ACCENT_CYAN
        )
        self.console_title.grid(row=0, column=0, sticky="w")

        self.clear_console_btn = ctk.CTkButton(
            self.console_header,
            text="Limpar",
            width=70,
            height=26,
            fg_color="#1d1e26",
            hover_color="#2a2b36",
            text_color=TEXT_PRIMARY,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            corner_radius=6,
            command=self.clear_logs
        )
        self.clear_console_btn.grid(row=0, column=1, padx=8, sticky="e")

        self.save_console_btn = ctk.CTkButton(
            self.console_header,
            text="Exportar Log",
            width=90,
            height=26,
            fg_color=ACCENT_ROYAL,
            hover_color=ACCENT_CYAN,
            text_color=TEXT_PRIMARY,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            corner_radius=6,
            command=self.save_logs
        )
        self.save_console_btn.grid(row=0, column=2, sticky="e")

        # The Log Textbox itself
        self.console_textbox = ctk.CTkTextbox(
            self.console_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color=BG_COLOR,
            text_color="#f8f8f2",
            border_width=0,
            corner_radius=8
        )
        self.console_textbox.grid(row=1, column=0, sticky="nsew", padx=20, pady=(0, 20))
        self.console_textbox.configure(state="disabled")

        # Setup custom color tags inside the console textbox
        self.console_textbox.tag_config("success", foreground=COLOR_SUCCESS)
        self.console_textbox.tag_config("error", foreground=COLOR_ERROR)
        self.console_textbox.tag_config("info", foreground=ACCENT_CYAN)
        self.console_textbox.tag_config("warning", foreground=COLOR_WARNING)

        # Welcome message in logs
        self.log_message("Sistema Klarke Inicializado. Parâmetros operacionais nominais.", tag="success")
        if not self.is_admin:
            self.log_message("AVISO: Sistema rodando em modo Usuário Padrão. Ferramentas administrativas estão bloqueadas.", tag="warning")

    # ==========================================
    # LOGGING UTILITIES
    # ==========================================

    def log_message(self, message, tag=None):
        def _update():
            self.console_textbox.configure(state="normal")
            timestamp = datetime.now().strftime("%H:%M:%S")
            self.console_textbox.insert("end", f"[{timestamp}] {message}\n", tag)
            self.console_textbox.configure(state="disabled")
            self.console_textbox.see("end")
        
        self.after(0, _update)

    def clear_logs(self):
        self.console_textbox.configure(state="normal")
        self.console_textbox.delete("1.0", "end")
        self.console_textbox.configure(state="disabled")

    def save_logs(self):
        try:
            log_dir = os.path.join(os.path.expanduser("~"), "Desktop")
            log_file = os.path.join(log_dir, f"klarke_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
            
            content = self.console_textbox.get("1.0", "end-1c")
            with open(log_file, "w", encoding="utf-8") as f:
                f.write(content)
                
            self.log_message(f"Log exportado com sucesso: {log_file}", tag="success")
        except Exception as e:
            self.log_message(f"Erro ao salvar log: {str(e)}", tag="error")

    # ==========================================
    # NAVIGATION AND PAGE SWITCHING
    # ==========================================

    def show_page(self, page_id):
        # Update Nav Active Buttons Highlight
        for pid, btn in self.nav_buttons.items():
            if pid == page_id:
                btn.configure(fg_color=ACCENT_ROYAL, text_color="#ffffff")
            else:
                btn.configure(fg_color="transparent", text_color=TEXT_PRIMARY)

        # Clear existing elements inside pages_frame
        for widget in self.pages_frame.winfo_children():
            widget.destroy()

        self.current_page = page_id

        if page_id == "dashboard":
            self.render_dashboard_page()
        elif page_id == "system":
            self.render_system_page()
        elif page_id == "network":
            self.render_network_page()
        elif page_id == "cleanup":
            self.render_cleanup_page()
        elif page_id == "shortcuts":
            self.render_shortcuts_page()

    # ==========================================
    # PAGE RENDERERS
    # ==========================================

    def render_dashboard_page(self):
        self.pages_frame.grid_columnconfigure(0, weight=1)
        self.pages_frame.grid_columnconfigure(1, weight=1)
        self.pages_frame.grid_rowconfigure(0, weight=1)

        # Retrieve system metrics
        specs = self.get_system_specs()

        # Left Column - Hardware Info
        left_col = ctk.CTkFrame(self.pages_frame, fg_color="transparent")
        left_col.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        left_col.grid_columnconfigure(0, weight=1)

        hw_card = ctk.CTkFrame(left_col, fg_color=CARD_BG, corner_radius=12, border_color="#1d1e26", border_width=1)
        hw_card.grid(row=0, column=0, sticky="nsew", pady=5)
        hw_card.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(hw_card, text="Especificações de Hardware", font=ctk.CTkFont(family="Segoe UI", size=17, weight="bold"), text_color=ACCENT_CYAN).grid(row=0, column=0, columnspan=2, sticky="w", padx=25, pady=(20, 15))

        self.create_info_row(hw_card, 1, "Sistema Operacional", specs["os"])
        self.create_info_row(hw_card, 2, "Placa Mãe", specs["motherboard"])
        self.create_info_row(hw_card, 3, "Processador", specs["cpu"], wrap=True)
        self.create_info_row(hw_card, 4, "Placa de Vídeo", specs["gpu"], wrap=True)
        self.create_info_row(hw_card, 5, "Tempo de Atividade", specs["uptime"])

        # Right Column - Network and Usage
        right_col = ctk.CTkFrame(self.pages_frame, fg_color="transparent")
        right_col.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        right_col.grid_columnconfigure(0, weight=1)

        net_card = ctk.CTkFrame(right_col, fg_color=CARD_BG, corner_radius=12, border_color="#1d1e26", border_width=1)
        net_card.grid(row=0, column=0, sticky="nsew", pady=5)
        net_card.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(net_card, text="Identificação e Uso", font=ctk.CTkFont(family="Segoe UI", size=17, weight="bold"), text_color=ACCENT_CYAN).grid(row=0, column=0, columnspan=2, sticky="w", padx=25, pady=(20, 15))

        self.create_info_row(net_card, 1, "Nome da Máquina", specs["hostname"])
        self.create_info_row(net_card, 2, "Endereço IP (Local)", specs["local_ip"])
        self.create_info_row(net_card, 3, "Endereço Físico (MAC)", specs["mac"])

        # Usage Bars
        usage_frame = ctk.CTkFrame(net_card, fg_color="transparent")
        usage_frame.grid(row=4, column=0, columnspan=2, sticky="ew", padx=25, pady=25)
        usage_frame.grid_columnconfigure(1, weight=1)

        # RAM Bar
        ram_pct = (specs['total_ram'] - specs['avail_ram']) / specs['total_ram'] if specs['total_ram'] > 0 else 0
        ctk.CTkLabel(usage_frame, text="Uso de Memória RAM", font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"), text_color=TEXT_SECONDARY).grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(usage_frame, text=f"{ram_pct*100:.1f}% ({specs['total_ram']-specs['avail_ram']:.1f} / {specs['total_ram']:.1f} GB)", font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"), text_color=TEXT_PRIMARY).grid(row=0, column=2, sticky="e")
        
        ram_bar = ctk.CTkProgressBar(usage_frame, height=14, corner_radius=7, progress_color=ACCENT_ROYAL, fg_color=BG_COLOR)
        ram_bar.grid(row=1, column=0, columnspan=3, sticky="ew", pady=(8, 20))
        ram_bar.set(ram_pct)

        # Disk Bar
        disk_pct = (specs['disk_total'] - specs['disk_free']) / specs['disk_total'] if specs['disk_total'] > 0 else 0
        ctk.CTkLabel(usage_frame, text="Uso de Disco (C:)", font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"), text_color=TEXT_SECONDARY).grid(row=2, column=0, sticky="w")
        ctk.CTkLabel(usage_frame, text=f"{disk_pct*100:.1f}% ({specs['disk_total']-specs['disk_free']:.1f} / {specs['disk_total']:.1f} GB)", font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"), text_color=TEXT_PRIMARY).grid(row=2, column=2, sticky="e")
        
        disk_bar = ctk.CTkProgressBar(usage_frame, height=14, corner_radius=7, progress_color=ACCENT_CYAN, fg_color=BG_COLOR)
        disk_bar.grid(row=3, column=0, columnspan=3, sticky="ew", pady=(8, 5))
        disk_bar.set(disk_pct)

    def create_info_row(self, parent_frame, row, title, val, wrap=False):
        if not val or val in ["Desconhecida", "Desconhecido", "Sem conexão"]:
            return

        row_frame = ctk.CTkFrame(parent_frame, fg_color="transparent")
        row_frame.grid(row=row, column=0, columnspan=2, sticky="ew", padx=25, pady=8)
        row_frame.grid_columnconfigure(1, weight=1)

        t_lbl = ctk.CTkLabel(row_frame, text=title, font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"), text_color=TEXT_SECONDARY)
        t_lbl.grid(row=0, column=0, sticky="w")

        v_lbl = ctk.CTkLabel(row_frame, text=val, font=ctk.CTkFont(family="Segoe UI", size=14, weight="normal"), text_color=TEXT_PRIMARY, wraplength=280 if wrap else 0, justify="right")
        v_lbl.grid(row=0, column=1, sticky="e")

    def render_system_page(self):
        self.pages_frame.grid_columnconfigure(0, weight=1)
        
        card = ctk.CTkFrame(self.pages_frame, fg_color=CARD_BG, corner_radius=12, border_color="#1d1e26", border_width=1)
        card.grid(row=0, column=0, sticky="nsew", pady=5)
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="Rotinas de Reparo do Sistema", font=ctk.CTkFont(family="Segoe UI", size=19, weight="bold"), text_color=ACCENT_CYAN).grid(row=0, column=0, sticky="w", padx=30, pady=(25, 5))
        ctk.CTkLabel(card, text="Ferramentas avançadas para correção de integridade de arquivos do Windows.", font=ctk.CTkFont(family="Segoe UI", size=13), text_color=TEXT_SECONDARY).grid(row=1, column=0, sticky="w", padx=30, pady=(0, 25))

        self.create_action_row(card, 2, "SFC Scannow", "Verifica e repara arquivos de sistema corrompidos a partir do cache.", lambda: self.run_task_thread("sfc /scannow", "SFC (System File Checker)"))
        self.create_action_row(card, 3, "DISM RestoreHealth", "Restaura a imagem do sistema corrompida baixando pacotes do Update.", lambda: self.run_task_thread("DISM /Online /Cleanup-Image /RestoreHealth", "DISM (Restore Health)"))
        self.create_action_row(card, 4, "Verificar Disco (CHKDSK)", "Analisa a unidade C: em busca de erros lógicos no sistema de arquivos.", lambda: self.run_task_thread("chkdsk c:", "CHKDSK (Verificação de Disco)"))
        self.create_action_row(card, 5, "Reparar Windows Store", "Limpa o cache da Microsoft Store para corrigir erros de download.", lambda: self.run_task_thread("wsreset.exe", "Reset Windows Store"))
        self.create_action_row(card, 6, "Limpar Cache de Ícones", "Resolve problemas de ícones em branco ou incorretos na área de trabalho.", lambda: self.run_task_thread("ie4uinit.exe -show && taskkill /IM explorer.exe /F && DEL /A /Q \"%localappdata%\\IconCache.db\" && DEL /A /F /Q \"%localappdata%\\Microsoft\\Windows\\Explorer\\iconcache*\" && start explorer.exe", "Reset Icon Cache"))

    def render_network_page(self):
        self.pages_frame.grid_columnconfigure(0, weight=1)
        
        card = ctk.CTkFrame(self.pages_frame, fg_color=CARD_BG, corner_radius=12, border_color="#1d1e26", border_width=1)
        card.grid(row=0, column=0, sticky="nsew", pady=5)
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="Diagnóstico e Reparo de Rede", font=ctk.CTkFont(family="Segoe UI", size=19, weight="bold"), text_color=ACCENT_CYAN).grid(row=0, column=0, sticky="w", padx=30, pady=(25, 5))
        ctk.CTkLabel(card, text="Resolve problemas de navegação lenta, conflito de IPs e falhas de TCP/IP.", font=ctk.CTkFont(family="Segoe UI", size=13), text_color=TEXT_SECONDARY).grid(row=1, column=0, sticky="w", padx=30, pady=(0, 25))

        self.create_action_row(card, 2, "Limpar DNS (Flush)", "Esvazia o cache resolvedor DNS local para recarregar as rotas da web.", lambda: self.run_task_thread("ipconfig /flushdns", "Flush DNS Cache"))
        self.create_action_row(card, 3, "Resetar TCP/IP", "Redefine a pilha Winsock e as configurações TCP/IP para os padrões.", lambda: self.run_task_thread("netsh winsock reset && netsh int ip reset", "Winsock & TCP/IP Reset"))
        self.create_action_row(card, 4, "Renovar IP Local", "Solicita ao roteador/DHCP um novo IP local e mascara de rede.", lambda: self.run_task_thread("ipconfig /release && ipconfig /renew", "Liberar/Renovar Endereço IP"))
        self.create_action_row(card, 5, "Teste de Ping (Internet)", "Envia 4 pacotes para o DNS do Google para avaliar perda de pacotes.", lambda: self.run_task_thread("ping -n 4 8.8.8.8", "Teste de Latência (Ping)"))
        self.create_action_row(card, 6, "Limpar Cache ARP", "Remove endereços físicos obsoletos da tabela de roteamento local.", lambda: self.run_task_thread("arp -d *", "Limpar Tabela ARP"))
        self.create_action_row(card, 7, "Rastreamento de Rota (Tracert)", "Exibe o caminho que os dados percorrem até o servidor da Cloudflare.", lambda: self.run_task_thread("tracert -d -w 100 1.1.1.1", "Tracert Cloudflare"))

    def render_cleanup_page(self):
        self.pages_frame.grid_columnconfigure(0, weight=1)

        card = ctk.CTkFrame(self.pages_frame, fg_color=CARD_BG, corner_radius=12, border_color="#1d1e26", border_width=1)
        card.grid(row=0, column=0, sticky="nsew", pady=5)
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="Otimização e Limpeza", font=ctk.CTkFont(family="Segoe UI", size=19, weight="bold"), text_color=ACCENT_CYAN).grid(row=0, column=0, sticky="w", padx=30, pady=(25, 5))
        ctk.CTkLabel(card, text="Libere espaço em disco e resolva travamentos de downloads e impressões.", font=ctk.CTkFont(family="Segoe UI", size=13), text_color=TEXT_SECONDARY).grid(row=1, column=0, sticky="w", padx=30, pady=(0, 25))

        self.create_action_row(card, 2, "Apagar Temporários", "Exclui lixo acumulado nas pastas Temp e Prefetch de todo o sistema.", self.run_python_temp_clean)
        self.create_action_row(card, 3, "Reset Windows Update", "Reinicia os serviços associados e exclui downloads pendentes bugados.", self.run_windows_update_reset)
        self.create_action_row(card, 4, "Reset Spooler de Impressão", "Reinicia o serviço de impressoras para destravar fila de documentos.", lambda: self.run_task_thread("net stop spooler && net start spooler", "Reinicialização do Spooler"))
        self.create_action_row(card, 5, "Esvaziar Lixeira", "Força a limpeza da lixeira de todos os discos locais.", lambda: self.run_task_thread('powershell.exe -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"', "Esvaziar Lixeira"))
        self.create_action_row(card, 6, "Limpar Logs de Eventos", "Apaga milhares de registros de log do Visualizador de Eventos.", lambda: self.run_task_thread('for /F "tokens=*" %1 in (\'wevtutil.exe el\') DO wevtutil.exe cl "%1"', "Limpar Eventos"))

    def render_shortcuts_page(self):
        self.pages_frame.grid_columnconfigure(0, weight=1)
        
        card = ctk.CTkFrame(self.pages_frame, fg_color=CARD_BG, corner_radius=12, border_color="#1d1e26", border_width=1)
        card.grid(row=0, column=0, sticky="nsew", pady=5)
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="Atalhos Administrativos Nativos", font=ctk.CTkFont(family="Segoe UI", size=19, weight="bold"), text_color=ACCENT_CYAN).grid(row=0, column=0, sticky="w", padx=30, pady=(25, 5))
        ctk.CTkLabel(card, text="Painéis de configuração nativos e poderosos já embutidos no Windows.", font=ctk.CTkFont(family="Segoe UI", size=13), text_color=TEXT_SECONDARY).grid(row=1, column=0, sticky="w", padx=30, pady=(0, 20))

        grid_frame = ctk.CTkFrame(card, fg_color="transparent")
        grid_frame.grid(row=2, column=0, sticky="ew", padx=25, pady=10)
        for i in range(3):
            grid_frame.grid_columnconfigure(i, weight=1)

        shortcuts = [
            ("Gerenciador de Dispositivos", "devmgmt.msc"),
            ("Gerenciador de Tarefas", "taskmgr.exe"),
            ("Gerenciamento de Disco", "diskmgmt.msc"),
            ("Editor de Registro", "regedit.exe"),
            ("Painel de Controle", "control.exe"),
            ("Visualizador de Eventos", "eventvwr.msc")
        ]

        r, c = 0, 0
        for name, cmd in shortcuts:
            btn = ctk.CTkButton(
                grid_frame, text=name, fg_color="#181a24", hover_color=ACCENT_ROYAL,
                text_color=TEXT_PRIMARY, font=ctk.CTkFont(family="Segoe UI", size=14, weight="bold"),
                height=60, corner_radius=8, command=lambda cmd=cmd, name=name: self.launch_native_tool(cmd, name)
            )
            btn.grid(row=r, column=c, padx=10, pady=10, sticky="ew")
            c += 1
            if c > 2:
                c = 0
                r += 1

    def create_action_row(self, parent, row, title, desc, action):
        frame = ctk.CTkFrame(parent, fg_color="#181a24", corner_radius=10)
        frame.grid(row=row, column=0, sticky="ew", padx=30, pady=10)
        frame.grid_columnconfigure(0, weight=1)

        txt_frame = ctk.CTkFrame(frame, fg_color="transparent")
        txt_frame.grid(row=0, column=0, sticky="w", padx=20, pady=15)

        ctk.CTkLabel(txt_frame, text=title, font=ctk.CTkFont(family="Segoe UI", size=15, weight="bold"), text_color=TEXT_PRIMARY).grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(txt_frame, text=desc, font=ctk.CTkFont(family="Segoe UI", size=13), text_color=TEXT_SECONDARY).grid(row=1, column=0, sticky="w", pady=(2,0))

        btn = ctk.CTkButton(
            frame, text="Executar Operação", width=140, height=40,
            fg_color=ACCENT_ROYAL, hover_color=ACCENT_CYAN,
            text_color=TEXT_PRIMARY, font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
            corner_radius=8, command=action
        )
        btn.grid(row=0, column=1, sticky="e", padx=25)

    # ==========================================
    # ACTION RUNNERS & THREADING
    # ==========================================

    def set_gui_state_running(self, running):
        self.is_running_task = running
        for btn in self.nav_buttons.values():
            btn.configure(state="normal" if not running else "disabled")

    def run_task_thread(self, cmd, title):
        if self.is_running_task:
            self.log_message("AVISO: Aguarde o processo atual ser concluído antes de iniciar outro.", tag="warning")
            return

        def _worker():
            self.set_gui_state_running(True)
            self.log_message(f"--- Iniciando: {title} ---", tag="info")
            try:
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                
                process = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    stdin=subprocess.PIPE, text=True, shell=True,
                    startupinfo=startupinfo, encoding='cp850', errors='ignore'
                )

                while True:
                    line = process.stdout.readline()
                    if not line and process.poll() is not None:
                        break
                    if line:
                        self.log_message(line.strip())

                if process.wait() == 0:
                    self.log_message(f"[SUCESSO] Operação {title} concluída com êxito.", tag="success")
                else:
                    self.log_message(f"[ERRO] Operação {title} falhou ou retornou erros.", tag="error")

            except Exception as e:
                self.log_message(f"Falha Crítica ao tentar executar: {str(e)}", tag="error")
            finally:
                self.set_gui_state_running(False)

        threading.Thread(target=_worker, daemon=True).start()

    def run_python_temp_clean(self):
        if self.is_running_task: return
        def _worker():
            self.set_gui_state_running(True)
            self.log_message("Iniciando varredura profunda de diretórios Temp e Prefetch...", tag="info")
            paths = [os.environ.get("TEMP"), r"C:\Windows\Temp", r"C:\Windows\Prefetch"]
            files_del, bytes_del, fails = 0, 0, 0

            for p in paths:
                if not p or not os.path.exists(p): continue
                self.log_message(f"Limpando diretório alvo: {p}")
                try:
                    for item in os.listdir(p):
                        ipath = os.path.join(p, item)
                        try:
                            if os.path.isfile(ipath):
                                size = os.path.getsize(ipath)
                                os.unlink(ipath)
                                files_del += 1
                                bytes_del += size
                            elif os.path.isdir(ipath):
                                size = sum(os.path.getsize(os.path.join(r, f)) for r, d, files in os.walk(ipath) for f in files)
                                shutil.rmtree(ipath)
                                files_del += 1
                                bytes_del += size
                        except: fails += 1
                except: pass

            self.log_message(f"[SUCESSO] Limpeza de Cache concluída. {files_del} itens removidos. Total Liberado: {bytes_del/(1024**2):.1f} MB.", tag="success")
            if fails > 0: self.log_message(f"NOTA: {fails} arquivos estão em uso pelo sistema operacional ou outros programas no momento.", tag="warning")
            self.set_gui_state_running(False)
        threading.Thread(target=_worker, daemon=True).start()

    def run_windows_update_reset(self):
        if self.is_running_task: return
        def _worker():
            self.set_gui_state_running(True)
            self.log_message("Iniciando reset forçado de componentes do Windows Update...", tag="info")
            steps = [
                ("Interrompendo Serviços do Update e Criptografia...", "net stop wuauserv && net stop cryptsvc && net stop bits && net stop msiserver"),
                ("Limpando cache de Downloads Corrompidos...", 'powershell -Command "Remove-Item -Path C:\\Windows\\SoftwareDistribution\\Download\\* -Recurse -Force -ErrorAction SilentlyContinue"'),
                ("Restabelecendo Serviços Vitais...", "net start wuauserv && net start cryptsvc && net start bits && net start msiserver")
            ]
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            for desc, cmd in steps:
                self.log_message(desc)
                try:
                    out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, shell=True, startupinfo=startupinfo, encoding='cp850', errors='ignore')
                    if out.strip(): self.log_message(out.strip())
                except: pass
            self.log_message("[SUCESSO] Rotina de Redefinição do Windows Update finalizada.", tag="success")
            self.set_gui_state_running(False)
        threading.Thread(target=_worker, daemon=True).start()

    def launch_native_tool(self, cmd, name):
        self.log_message(f"Acionando Painel Administrativo Nativo: {name}...", tag="info")
        try:
            subprocess.Popen(cmd, shell=True)
            self.log_message(f"{name} executado.", tag="success")
        except Exception as e:
            self.log_message(f"Erro ao lançar executável nativo: {str(e)}", tag="error")

    def request_elevation(self):
        try:
            params = f'"{sys.argv[0]}" ' + ' '.join(f'"{a}"' for a in sys.argv[1:]) if sys.argv[0].endswith('.py') else ' '.join(f'"{a}"' for a in sys.argv[1:])
            ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
            sys.exit(0)
        except Exception as e:
            self.log_message(f"Privilégios negados ou operação cancelada: {str(e)}", tag="error")

    def resource_path(self, relative_path):
        try:
            base_path = sys._MEIPASS
        except Exception:
            base_path = os.path.abspath(".")
        return os.path.join(base_path, relative_path)

    # ==========================================
    # SYSTEM INFORMATION QUERIES
    # ==========================================

    def get_system_specs(self):
        specs = {
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()} (Build {platform.version()})",
            "cpu": platform.processor(),
            "gpu": "Desconhecida",
            "motherboard": "Desconhecida",
            "uptime": "Desconhecido",
            "mac": "Desconhecido",
            "total_ram": 0.0,
            "avail_ram": 0.0,
            "disk_total": 0.0,
            "disk_free": 0.0,
            "local_ip": "Sem conexão"
        }

        # Subprocess startup info to hide cmd window
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        # GPU via WMIC
        try:
            out = subprocess.check_output("wmic path win32_VideoController get name", shell=True, startupinfo=si, text=True)
            gpu_lines = [l.strip() for l in out.split('\n') if l.strip() and "Name" not in l]
            if gpu_lines: specs["gpu"] = gpu_lines[0]
        except: pass

        # Motherboard via WMIC
        try:
            out = subprocess.check_output("wmic baseboard get product,Manufacturer", shell=True, startupinfo=si, text=True)
            lines = [l.strip() for l in out.split('\n') if l.strip() and "Manufacturer" not in l]
            if lines: specs["motherboard"] = ' '.join(lines[0].split())
        except: pass

        # Uptime via kernel32 GetTickCount64
        try:
            millis = int(ctypes.windll.kernel32.GetTickCount64())
            seconds = (millis // 1000) % 60
            minutes = (millis // (1000 * 60)) % 60
            hours = (millis // (1000 * 60 * 60)) % 24
            days = (millis // (1000 * 60 * 60 * 24))
            
            if days >= 1:
                specs["uptime"] = f"{days} dias, {hours}h {minutes}m"
            else:
                specs["uptime"] = f"{hours}h {minutes}m {seconds}s"
        except: pass

        # MAC Address
        try:
            mac_num = hex(uuid.getnode()).replace('0x', '').upper()
            mac_str = ':'.join(mac_num[i: i + 2] for i in range(0, 12, 2))
            specs["mac"] = mac_str
        except: pass

        # CPU Name Fallback via Registry (More accurate than platform.processor)
        try:
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            specs["cpu"] = winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
            winreg.CloseKey(key)
        except: pass

        # RAM
        try:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong), ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong), ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong), ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong), ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(stat)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            specs["total_ram"] = stat.ullTotalPhys / (1024 ** 3)
            specs["avail_ram"] = stat.ullAvailPhys / (1024 ** 3)
        except: pass

        # Disk
        try:
            total, used, free = shutil.disk_usage("C:")
            specs["disk_total"] = total / (1024 ** 3)
            specs["disk_free"] = free / (1024 ** 3)
        except: pass

        # IP
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            specs["local_ip"] = s.getsockname()[0]
            s.close()
        except: pass

        return specs

if __name__ == "__main__":
    app = KlarkeRepairTool()
    app.mainloop()
