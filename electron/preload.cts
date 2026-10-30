const { contextBridge, ipcRenderer } = require("electron");

// Ponte mínima: um único `invoke`. A allowlist de comandos, a validação de entrada e a checagem do remetente
// ficam no processo principal (src/interface/electron/ipc/commands.ts), que é a fonte única dos nomes.
let nextId = 0;
contextBridge.exposeInMainWorld("asyncVideira", Object.freeze({
  invoke: (command: string, payload: unknown = {}) => ipcRenderer.invoke("av:invoke", { requestId: `ui-${++nextId}`, command, payload }),
  // Progresso das operações (só leitura, enviado pelo processo principal). Devolve a função que cancela a inscrição.
  onProgress: (listener: (message: unknown) => void) => {
    const handler = (_event: unknown, message: unknown) => listener(message);
    ipcRenderer.on("av:progress", handler);
    return () => { ipcRenderer.removeListener("av:progress", handler); };
  },
}));
