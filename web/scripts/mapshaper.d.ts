declare module 'mapshaper' {
  const mapshaper: {
    /** Runs mapshaper commands in memory. Inputs and outputs map file names to their contents. */
    applyCommands(
      commands: string,
      input?: Record<string, string | Uint8Array>,
    ): Promise<Record<string, string | Uint8Array>>
  }
  export default mapshaper
}
