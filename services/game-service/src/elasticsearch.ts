import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
    node: `http://${process.env.ELASTICSEARCH_HOST || 'elasticsearch'}:${process.env.ELASTICSEARCH_PORT || 9200}`,
});

const INDEX = process.env.ELASTICSEARCH_INDEX || 'games';

export interface GameDocument {
    id: string;
    title: string;
    description: string;
    genre: string;
    format: string | null;
    uploaderUsername: string;
    playCount: number;
    likeCount: number;
    createdAt: string;
}

/** Ensure the games index exists with proper mappings */
export async function ensureIndex(): Promise<void> {
    const exists = await esClient.indices.exists({ index: INDEX });
    if (!exists) {
        await esClient.indices.create({
            index: INDEX,
            mappings: {
                properties: {
                    id: { type: 'keyword' },
                    title: { type: 'text', analyzer: 'standard' },
                    description: { type: 'text', analyzer: 'standard' },
                    genre: { type: 'keyword' },
                    format: { type: 'keyword' },
                    uploaderUsername: { type: 'keyword' },
                    playCount: { type: 'integer' },
                    likeCount: { type: 'integer' },
                    createdAt: { type: 'date' },
                },
            },
        });
        console.log(`[elasticsearch] Created index: ${INDEX}`);
    }
}

export async function searchGames(params: {
    q?: string;
    genre?: string;
    format?: string;
    sort?: 'newest' | 'popular' | 'trending';
    from?: number;
    size?: number;
}): Promise<{ hits: GameDocument[]; total: number }> {
    const { q, genre, format, sort = 'newest', from = 0, size = 20 } = params;

    const must: object[] = [];
    const filter: object[] = [];

    if (q) {
        must.push({
            multi_match: {
                query: q,
                fields: ['title^3', 'description'],
                fuzziness: 'AUTO',
            },
        });
    }

    if (genre) filter.push({ term: { genre } });
    if (format) filter.push({ term: { format } });

    const sortConfig = {
        newest: [{ createdAt: { order: 'desc' } }],
        popular: [{ playCount: { order: 'desc' } }],
        trending: [{ likeCount: { order: 'desc' } }, { playCount: { order: 'desc' } }],
    }[sort];

    const response = await esClient.search<GameDocument>({
        index: INDEX,
        from,
        size,
        query: { bool: { must: must.length ? must : [{ match_all: {} }], filter } },
        sort: sortConfig as Parameters<typeof esClient.search>[0]['sort'],
    });

    const hits = response.hits.hits.map((h) => h._source as GameDocument);
    const total = typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    return { hits, total };
}

export async function indexGame(doc: GameDocument): Promise<void> {
    await esClient.index({ index: INDEX, id: doc.id, document: doc });
}

export async function removeGame(gameId: string): Promise<void> {
    await esClient.delete({ index: INDEX, id: gameId });
}

export async function checkEsHealth(): Promise<boolean> {
    try {
        const health = await esClient.cluster.health();
        return health.status !== 'red';
    } catch {
        return false;
    }
}

export { esClient, INDEX };
