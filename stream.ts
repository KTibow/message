export class StreamingJsonParser {
  buffer = "";
  depth = 0;
  onJson = (obj: any[]) => {};

  parseChunk(chunk: string) {
    for (const char of chunk) {
      if (char === "[") {
        this.depth++;
      } else if (char === "]") {
        this.depth--;

        if (this.depth === 2) {
          this.buffer += char;
          this.emit();
        }
      }
      if (this.depth > 2) this.buffer += char;
    }
  }
  emit() {
    try {
      const parsedJson = JSON.parse(this.buffer);
      if (this.onJson) {
        this.onJson(parsedJson);
      }
    } catch (error) {
      console.error("Error parsing JSON:", error);
    }
    this.buffer = "";
  }
}
