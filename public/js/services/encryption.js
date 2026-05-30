const SECRET = "JT44634hfgJFGGJgj76df6FGG43gj43g";

export async function encryptMessage(text) {
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(SECRET),
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv
        },
        key,
        encoder.encode(text)
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);

    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...result));
}


export async function decryptMessage(cipherText) {
    if (!cipherText) return "";

    try {
        const bytes = Uint8Array.from(
            atob(cipherText),
            c => c.charCodeAt(0)
        );

        const iv = bytes.slice(0, 12);
        const encrypted = bytes.slice(12);

        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(SECRET),
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        const decrypted = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv
            },
            key,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    } catch (error) {
        return cipherText;
    }
}