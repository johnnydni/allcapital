//! Encrypted per-profile data file.
//!
//! All asset and financial data lives here, encrypted with XChaCha20-Poly1305.
//! The key is derived from the user's password (Argon2id) and exists only in
//! memory while the profile is unlocked. Without the password the file cannot
//! be read – by anyone, including us. There is no recovery.

use crate::storage::write_private;
use crate::devices::Device;
use crate::properties::Property;
use crate::vehicles::Vehicle;
use chacha20poly1305::aead::{Aead, AeadCore, KeyInit, OsRng, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use zeroize::Zeroizing;

const MAGIC: &[u8; 4] = b"ACV1";
const NONCE_LEN: usize = 24;
const ERR_VAULT: &str = "Deine Daten konnten nicht gelesen oder gespeichert werden.";

pub type VaultKey = Zeroizing<[u8; 32]>;

#[derive(Default, Serialize, Deserialize)]
pub struct VaultData {
    #[serde(default)]
    pub vehicles: Vec<Vehicle>,
    #[serde(default)]
    pub properties: Vec<Property>,
    #[serde(default)]
    pub devices: Vec<Device>,
}

pub struct Vault {
    dir: PathBuf,
}

impl Vault {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    fn file_name(profile_id: &str) -> Result<String, String> {
        // The id becomes part of a file name: accept nothing but a UUID.
        uuid::Uuid::parse_str(profile_id).map(|id| format!("vault-{id}.bin")).map_err(|_| ERR_VAULT.to_string())
    }

    pub fn load(&self, profile_id: &str, key: &VaultKey) -> Result<VaultData, String> {
        let bytes = match fs::read(self.dir.join(Self::file_name(profile_id)?)) {
            Ok(b) => b,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(VaultData::default()),
            Err(_) => return Err(ERR_VAULT.into()),
        };
        if bytes.len() < MAGIC.len() + NONCE_LEN || &bytes[..MAGIC.len()] != MAGIC {
            return Err(ERR_VAULT.into());
        }
        let (nonce, ciphertext) = bytes[MAGIC.len()..].split_at(NONCE_LEN);
        let plain = Zeroizing::new(
            XChaCha20Poly1305::new(key.as_slice().into())
                .decrypt(XNonce::from_slice(nonce), Payload { msg: ciphertext, aad: profile_id.as_bytes() })
                .map_err(|_| ERR_VAULT.to_string())?,
        );
        serde_json::from_slice(&plain).map_err(|_| ERR_VAULT.to_string())
    }

    pub fn save(&self, profile_id: &str, key: &VaultKey, data: &VaultData) -> Result<(), String> {
        let name = Self::file_name(profile_id)?;
        let plain = Zeroizing::new(serde_json::to_vec(data).map_err(|_| ERR_VAULT.to_string())?);
        // A fresh random nonce per write; the profile id is bound as associated data.
        let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
        let ciphertext = XChaCha20Poly1305::new(key.as_slice().into())
            .encrypt(&nonce, Payload { msg: plain.as_slice(), aad: profile_id.as_bytes() })
            .map_err(|_| ERR_VAULT.to_string())?;
        let mut out = Vec::with_capacity(MAGIC.len() + NONCE_LEN + ciphertext.len());
        out.extend_from_slice(MAGIC);
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&ciphertext);
        write_private(&self.dir, &name, &out).map_err(|_| ERR_VAULT.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "0b8f3c7e-6a1d-4c7b-9a43-1f2e3d4c5b6a";
    const OTHER: &str = "11111111-2222-4333-8444-555555555555";

    fn key(byte: u8) -> VaultKey {
        Zeroizing::new([byte; 32])
    }

    #[test]
    fn round_trip_and_tamper_detection() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path().to_path_buf());
        assert!(vault.load(ID, &key(1)).unwrap().vehicles.is_empty());

        let mut data = VaultData::default();
        data.vehicles.push(crate::vehicles::tests::sample_vehicle());
        vault.save(ID, &key(1), &data).unwrap();
        assert_eq!(vault.load(ID, &key(1)).unwrap().vehicles[0].draft.model, "Golf");

        let path = dir.path().join(format!("vault-{ID}.bin"));
        let raw = fs::read(&path).unwrap();
        assert!(!raw.windows(4).any(|w| w == b"Golf"), "plaintext must not appear on disk");

        assert!(vault.load(ID, &key(2)).is_err(), "wrong key");
        fs::copy(&path, dir.path().join(format!("vault-{OTHER}.bin"))).unwrap();
        assert!(vault.load(OTHER, &key(1)).is_err(), "file is bound to its profile");

        let mut flipped = raw.clone();
        *flipped.last_mut().unwrap() ^= 1;
        fs::write(&path, flipped).unwrap();
        assert!(vault.load(ID, &key(1)).is_err(), "tampering is detected");
    }

    #[test]
    fn rejects_ids_that_are_not_uuids() {
        let dir = tempfile::tempdir().unwrap();
        let vault = Vault::new(dir.path().to_path_buf());
        assert!(vault.save("../evil", &key(1), &VaultData::default()).is_err());
    }
}
