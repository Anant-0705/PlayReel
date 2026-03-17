import * as admin from 'firebase-admin';

let initialized = false;

export function initFirebase(): void {
    if (initialized) return;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        console.warn('[firebase] FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM push disabled');
        return;
    }

    const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log('[firebase] Admin SDK initialized');
}

export interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

/**
 * Send a push notification to multiple FCM device tokens.
 * Uses sendEachForMulticast — handles partial failures gracefully.
 * Silently skips if Firebase is not initialized (no service account).
 */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<void> {
    if (!initialized || tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: payload.data ?? {},
        android: {
            priority: 'high',
        },
        apns: {
            payload: {
                aps: { sound: 'default', badge: 1 },
            },
        },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
        `[firebase] Sent ${response.successCount}/${tokens.length} notifications` +
        (response.failureCount > 0 ? ` (${response.failureCount} failed)` : ''),
    );

    // Log individual failures (don't throw — some tokens may be stale)
    response.responses.forEach((r, i) => {
        if (!r.success) {
            console.warn(`[firebase] Token ${i} failed: ${r.error?.message}`);
        }
    });
}
