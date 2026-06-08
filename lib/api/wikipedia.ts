type WikipediaSummary = {
  extract?: string;
  thumbnail?: { source: string };
  originalimage?: { source: string };
};

export type DestinationSummary = {
  description: string;
  imageUrl?: string;
};

export async function getDestinationSummary(
  name: string,
): Promise<DestinationSummary | null> {
  try {
    const response = await fetch(
      `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
    );
    if (!response.ok) return null;

    const result = (await response.json()) as WikipediaSummary;
    if (!result.extract?.trim()) return null;

    return {
      description: result.extract.trim(),
      imageUrl: result.originalimage?.source ?? result.thumbnail?.source,
    };
  } catch {
    return null;
  }
}
