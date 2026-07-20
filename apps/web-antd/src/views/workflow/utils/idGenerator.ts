let counter = 0;

export function generateUniqueId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const seq = ++counter;
  return `${timestamp}-${random}-${seq}`;
}

export function generateFlowId(): string {
  return `flow-${generateUniqueId()}`;
}