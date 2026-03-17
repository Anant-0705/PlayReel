import { Client } from '@elastic/elasticsearch';

export const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
});

export const GAME_INDEX = 'games';

export interface GameDocument {
    id: string;
    title: string;
    description: string;
    genre: string;
    format: string;          // 'zip' | 'wasm' | 'unity' | 'godot' | 'html5'
    uploader_id: string;
    uploader_username: string;
    thumbnail_url: string | null;
    manifest_url: string;
    play_count: number;
    like_count: number;
    status: string;
    published_at: string;    // ISO8601
}

/** Index or re-index a game document */
export async function indexGame(doc: GameDocument): Promise<void> {
    await esClient.index({
        index: GAME_INDEX,
        id: doc.id,
        document: doc,
    });
}

export async function checkEsHealth(): Promise<boolean> {
    try {
        const { status } = await esClient.cluster.health();
        return status !== 'red';
    } catch { return false; }
}
