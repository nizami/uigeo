export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type TransformerModel = {
  // locked?: boolean;
  // draggable?: boolean;
  position: Position;
  size: Size;
  rotation?: number;
};
