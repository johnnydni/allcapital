//! Private, crash-safe file writes shared by the profile store and the vault.

use std::fs;
use std::io::Write;
use std::path::Path;

/// Writes `bytes` to `dir/name` via temp file, fsync and rename, so a crash
/// never leaves a half-written file. Directory and file are owner-only.
pub fn write_private(dir: &Path, name: &str, bytes: &[u8]) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    restrict(dir, 0o700)?;
    let tmp = dir.join(format!("{name}.{}.tmp", uuid::Uuid::new_v4()));
    let mut opts = fs::OpenOptions::new();
    opts.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let result = (|| {
        let mut file = opts.open(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&tmp, dir.join(name))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

fn restrict(path: &Path, mode: u32) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(mode))?;
    }
    #[cfg(not(unix))]
    let _ = (path, mode);
    Ok(())
}

pub fn now_secs() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Current calendar year (UTC), good enough for age calculations.
pub fn current_year() -> u16 {
    (1970 + now_secs() / 31_556_952) as u16
}
