/// <reference types="vite/client" />

declare module '@hyperunicorn/data/scores' {
  import type { ScoreOutput } from '@hyperunicorn/core';
  const content: ScoreOutput;
  export default content;
}

declare module '@hyperunicorn/data/events' {
  import type { EventStream } from '@hyperunicorn/core';
  const content: EventStream;
  export default content;
}
