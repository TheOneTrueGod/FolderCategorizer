export function imageUrl(folderId: string, filename: string): string {
  return `catalog://image/${folderId}/${encodeURIComponent(filename)}`
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Something went wrong'
}
