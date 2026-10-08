declare module 'mapshaper' {
  const mapshaper: {
    /**
     * Runs mapshaper commands in memory. Inputs and outputs map file names to their contents.
     * A binary input must be a Buffer: mapshaper skips a plain Uint8Array as missing.
     */
    applyCommands(
      commands: string,
      input?: Record<string, string | Buffer>,
    ): Promise<Record<string, string | Buffer>>
  }
  export default mapshaper
}
