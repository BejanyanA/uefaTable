const DB_NAME = "uefaresults-keys";
const STORE_NAME = "keys";
const PRIVATE_KEY_ID = "ecdh-private-jwk";
const PUBLIC_KEY_ID = "ecdh-public-jwk";

// Retained only as a decryption fallback for messages sent before the E2E upgrade.
// New messages are never encrypted with this key.
const LEGACY_SECRET = "JT44634hfgJFGGJgj76df6FGG43gj43g";

function openKeyDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

function dbGet(db, id) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
}

function dbPut(db, id, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(value, id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

let _keyPairCache = null;
let _legacyKey = null;

async function getLegacyKey() {
    if (_legacyKey) return _legacyKey;
    _legacyKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(LEGACY_SECRET),
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
    return _legacyKey;
}

export async function getOrCreateKeyPair() {
    if (_keyPairCache) return _keyPairCache;

    const db = await openKeyDb();
    const storedPrivateJwk = await dbGet(db, PRIVATE_KEY_ID);
    const storedPublicJwk = await dbGet(db, PUBLIC_KEY_ID);

    if (storedPrivateJwk && storedPublicJwk) {
        const privateKey = await crypto.subtle.importKey(
            "jwk",
            storedPrivateJwk,
            { name: "ECDH", namedCurve: "P-256" },
            false,
            ["deriveKey"]
        );
        const publicKey = await crypto.subtle.importKey(
            "jwk",
            storedPublicJwk,
            { name: "ECDH", namedCurve: "P-256" },
            true,
            []
        );
        _keyPairCache = { privateKey, publicKey, publicKeyJwk: storedPublicJwk };
        return _keyPairCache;
    }

    const keyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );

    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

    await dbPut(db, PRIVATE_KEY_ID, privateJwk);
    await dbPut(db, PUBLIC_KEY_ID, publicJwk);

    _keyPairCache = {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        publicKeyJwk: publicJwk
    };

    return _keyPairCache;
}

export async function deriveConversationKey(myPrivateKey, theirPublicKeyJwk) {
    const theirPublicKey = await crypto.subtle.importKey(
        "jwk",
        theirPublicKeyJwk,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
    );

    return crypto.subtle.deriveKey(
        { name: "ECDH", public: theirPublicKey },
        myPrivateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function encryptMessage(text, conversationKey) {
    const key = conversationKey ?? await getLegacyKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(text)
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...result));
}

export async function decryptMessage(cipherText, conversationKey) {
    if (!cipherText) return "";

    const bytes = Uint8Array.from(atob(cipherText), c => c.charCodeAt(0));
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);

    if (conversationKey) {
        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                conversationKey,
                encrypted
            );
            return new TextDecoder().decode(decrypted);
        } catch {
            // fall through to legacy
        }
    }

    try {
        const legacyKey = await getLegacyKey();
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            legacyKey,
            encrypted
        );
        return new TextDecoder().decode(decrypted);
    } catch {
        return cipherText;
    }
}
