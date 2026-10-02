const transientRequestPattern = /(failed to fetch|load failed|network(?:error| request failed)?|timed?\s*out)/i;

export function isTransientRequestError(error: unknown) {
  if (error instanceof TypeError) return true;
  return error instanceof Error && transientRequestPattern.test(error.message);
}

export async function retryTransientRequest<T>(request: () => Promise<T>, delayMs = 350): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!isTransientRequestError(error)) throw error;
    await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
    return request();
  }
}
