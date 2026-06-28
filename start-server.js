// Entry point usado pelo PM2 na VPS.
// Apenas sobe o backend — o app.listen() do server.js já mantém o processo vivo.
require('./backend/server.js');
