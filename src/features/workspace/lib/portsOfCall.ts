export interface PortOfCall {
  id: string
  name: string
  x: number
  y: number
  zoom: number
}

const storageKey = (boardId: string) => `meboard:ports:${boardId}`

export function loadPorts(boardId: string): PortOfCall[] {
  try {
    const raw = localStorage.getItem(storageKey(boardId))
    return raw ? (JSON.parse(raw) as PortOfCall[]) : []
  } catch {
    return []
  }
}

export function savePorts(boardId: string, ports: PortOfCall[]): void {
  localStorage.setItem(storageKey(boardId), JSON.stringify(ports))
}

export function addPort(boardId: string, port: PortOfCall): void {
  const ports = loadPorts(boardId)
  ports.push(port)
  savePorts(boardId, ports)
}

export function removePort(boardId: string, portId: string): void {
  savePorts(boardId, loadPorts(boardId).filter((p) => p.id !== portId))
}
