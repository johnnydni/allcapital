//! Tech devices: validation and a depreciation-based value range.

use crate::vehicles::{clean_text, condition_factor, round_to, Condition, Estimate, ValuePoint, MAX_CENTS};
use serde::{Deserialize, Serialize};

pub const MAX_DEVICES: usize = 500;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DeviceKind {
    Computer,
    Laptop,
    Smartphone,
    Tablet,
    Monitor,
    Grafikkarte,
    Prozessor,
    Arbeitsspeicher,
    Konsole,
    Kamera,
    Audio,
    Sonstiges,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DeviceDraft {
    pub kind: DeviceKind,
    pub name: String,
    pub condition: Condition,
    pub purchase_price_cents: Option<i64>,
    pub purchase_year: Option<u16>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    #[serde(flatten)]
    pub draft: DeviceDraft,
    pub created_at: u64,
    pub history: Vec<ValuePoint>,
}

impl DeviceDraft {
    pub fn validated(mut self, year_now: u16) -> Result<Self, String> {
        self.name = clean_text(&self.name, "Bezeichnung", true)?;
        if self.purchase_price_cents.is_some() != self.purchase_year.is_some() {
            return Err("Bitte gib Kaufpreis und Kaufjahr zusammen an.".into());
        }
        if let (Some(price), Some(year)) = (self.purchase_price_cents, self.purchase_year) {
            if price <= 0 || price > MAX_CENTS {
                return Err("Der Kaufpreis ist ungültig.".into());
            }
            if year < 1970 || year > year_now {
                return Err("Das Kaufjahr ist ungültig.".into());
            }
        }
        Ok(self)
    }
}

/// (first year, every later year) loss in value.
fn rates(kind: DeviceKind) -> (f64, f64) {
    match kind {
        DeviceKind::Smartphone => (0.35, 0.20),
        DeviceKind::Laptop | DeviceKind::Tablet => (0.30, 0.18),
        DeviceKind::Computer | DeviceKind::Arbeitsspeicher => (0.25, 0.18),
        DeviceKind::Grafikkarte | DeviceKind::Prozessor => (0.25, 0.15),
        DeviceKind::Monitor | DeviceKind::Konsole | DeviceKind::Kamera | DeviceKind::Audio => (0.20, 0.12),
        DeviceKind::Sonstiges => (0.25, 0.15),
    }
}

pub fn estimate(d: &DeviceDraft, year_now: u16) -> Result<Estimate, String> {
    let (Some(price), Some(year)) = (d.purchase_price_cents, d.purchase_year) else {
        return Err("Für eine Schätzung brauchen wir Kaufpreis und Kaufjahr.".into());
    };
    let (first, later) = rates(d.kind);
    let age = year_now.saturating_sub(year);
    let mut value = price as f64;
    if age >= 1 {
        value *= 1.0 - first;
        value *= (1.0 - later).powi(i32::from(age - 1));
    }
    let mid = value * condition_factor(d.condition);
    let step = if mid >= 100_000.0 { 1_000 } else { 100 };
    Ok(Estimate {
        low_cents: round_to(mid * 0.85, step),
        mid_cents: round_to(mid, step),
        high_cents: round_to(mid * 1.15, step),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft() -> DeviceDraft {
        DeviceDraft {
            kind: DeviceKind::Grafikkarte,
            name: " GPU - RTX 3080 ".into(),
            condition: Condition::Gut,
            purchase_price_cents: Some(100_000),
            purchase_year: Some(2023),
        }
    }

    #[test]
    fn validation() {
        assert_eq!(draft().validated(2026).unwrap().name, "GPU - RTX 3080");
        let mut d = draft();
        d.purchase_year = None;
        assert!(d.validated(2026).is_err());
        let mut d = draft();
        d.purchase_year = Some(2027);
        assert!(d.validated(2026).is_err());
        let mut d = draft();
        d.name = "".into();
        assert!(d.validated(2026).is_err());
    }

    #[test]
    fn estimate_depreciates_and_rounds() {
        // 1,000 € · 0.75 · 0.85² = 541.88 € → 542 €.
        let e = estimate(&draft(), 2026).unwrap();
        assert_eq!(e.mid_cents, 54_200);
        assert!(e.low_cents < e.mid_cents && e.mid_cents < e.high_cents);
        // Bought this year: purchase price.
        let mut fresh = draft();
        fresh.purchase_year = Some(2026);
        assert_eq!(estimate(&fresh, 2026).unwrap().mid_cents, 100_000);
        let mut no_price = draft();
        no_price.purchase_price_cents = None;
        no_price.purchase_year = None;
        assert!(estimate(&no_price, 2026).is_err());
    }
}
