
        function uint8ArrayToBase64(bytes) {
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            return btoa(binary);
        }
        function base64ToUint8Array(base64) {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return bytes;
        }
        async function getKeyMaterial(passphrase) {
            const enc = new TextEncoder();
            return crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']);
        }
        async function deriveAESKey(passphrase, salt) {
            const keyMaterial = await getKeyMaterial(passphrase);
            return crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        }
        self.onmessage = async function (e) {
            const { action, payload, passphrase, id } = e.data;
            try {
                if (action === 'encrypt') {
                    const salt = crypto.getRandomValues(new Uint8Array(16));
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const key = await deriveAESKey(passphrase, salt);
                    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
                    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
                    self.postMessage({ id, success: true, result: {
                        salt: uint8ArrayToBase64(salt),
                        iv: uint8ArrayToBase64(iv),
                        ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext))
                    }});
                } else if (action === 'decrypt') {
                    const salt = base64ToUint8Array(payload.salt);
                    const iv = base64ToUint8Array(payload.iv);
                    const ct = base64ToUint8Array(payload.ciphertext);
                    const key = await deriveAESKey(passphrase, salt);
                    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
                    self.postMessage({ id, success: true, result: JSON.parse(new TextDecoder().decode(decrypted)) });
                }
            } catch (err) {
                self.postMessage({ id, success: false, error: err.message });
            }
        };
    