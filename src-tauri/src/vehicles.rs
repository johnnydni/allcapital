//! Vehicles: validation and the value estimate.
//!
//! Money is always handled as integer cents.
//!
//! The estimate is a rule of thumb, not a market valuation: it depreciates the
//! purchase price with age-dependent rates and adjusts for condition and
//! mileage. It deliberately returns a range, and nothing at all where the rule
//! does not apply (classic cars, missing purchase data).

use serde::{Deserialize, Serialize};

const MAX_TEXT: usize = 60;
const MAX_EQUIPMENT: usize = 20;
pub(crate) const MAX_CENTS: i64 = 1_000_000_000_000; // 10 billion €
pub const MAX_VEHICLES: usize = 200;
pub const MAX_JOURNAL_ENTRIES: usize = 5000;
const MAX_NOTE: usize = 200;
const CLASSIC_AGE: u16 = 30;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VehicleKind {
    Automobil,
    Fahrrad,
    Escooter,
    Motorrad,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Drive {
    Verbrenner,
    Elektro,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Condition {
    Schlecht,
    Mittel,
    Gut,
    SehrGut,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValueSource {
    Estimate,
    Manual,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VehicleDraft {
    pub kind: VehicleKind,
    pub drive: Option<Drive>,
    pub brand: String,
    pub model: String,
    pub variant: String,
    pub build_year: u16,
    pub first_registration: u16,
    pub condition: Condition,
    pub equipment: Vec<String>,
    pub power_ps: Option<u32>,
    pub mileage_km: Option<u32>,
    pub purchase_price_cents: Option<i64>,
    pub purchase_year: Option<u16>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValuePoint {
    pub at: u64,
    pub cents: i64,
    pub source: ValueSource,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JournalCategory {
    Steuer,
    Versicherung,
    Kraftstoff,
    Sonstiges,
    Werkstatt,
    Teile,
    Fahrt,
}

/// One line in a vehicle's journal: a cost, a workshop visit or a trip.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JournalDraft {
    /// Calendar date, `YYYY-MM-DD`.
    pub date: String,
    pub category: JournalCategory,
    pub amount_cents: Option<i64>,
    pub km: Option<u32>,
    pub note: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JournalEntry {
    pub id: String,
    #[serde(flatten)]
    pub draft: JournalDraft,
}

/// Accepts only real calendar dates between 1900 and 2200.
pub fn check_date(raw: &str) -> Result<String, String> {
    let err = || "Das Datum ist ungültig.".to_string();
    let parts: Vec<&str> = raw.split('-').collect();
    let [y, m, d] = parts.as_slice() else { return Err(err()) };
    if y.len() != 4 || m.len() != 2 || d.len() != 2 || !raw.bytes().all(|b| b.is_ascii_digit() || b == b'-') {
        return Err(err());
    }
    let (y, m, d): (u32, u32, u32) = (y.parse().map_err(|_| err())?, m.parse().map_err(|_| err())?, d.parse().map_err(|_| err())?);
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let days = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return Err(err()),
    };
    if !(1900..=2200).contains(&y) || d == 0 || d > days {
        return Err(err());
    }
    Ok(raw.to_string())
}

impl JournalDraft {
    pub fn validated(mut self) -> Result<Self, String> {
        self.date = check_date(&self.date)?;
        self.note = self.note.trim().to_string();
        if self.note.chars().count() > MAX_NOTE || self.note.chars().any(char::is_control) {
            return Err("Die Notiz ist ungültig.".into());
        }
        if self.amount_cents.is_some_and(|c| !(0..=MAX_CENTS).contains(&c)) {
            return Err("Der Betrag ist ungültig.".into());
        }
        if self.km.is_some_and(|km| km > 5_000_000) {
            return Err("Die Kilometerangabe ist ungültig.".into());
        }
        let trip = self.category == JournalCategory::Fahrt;
        if trip && self.km.unwrap_or(0) == 0 {
            return Err("Bitte gib die gefahrenen Kilometer an.".into());
        }
        if !trip && self.amount_cents.is_none() {
            return Err("Bitte gib einen Betrag an.".into());
        }
        Ok(self)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vehicle {
    pub id: String,
    #[serde(flatten)]
    pub draft: VehicleDraft,
    pub created_at: u64,
    pub history: Vec<ValuePoint>,
    #[serde(default)]
    pub journal: Vec<JournalEntry>,
    /// Date of the next planned workshop visit, `YYYY-MM-DD`.
    #[serde(default)]
    pub next_service: Option<String>,
}

/// What the UI receives: the stored vehicle plus derived figures.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VehicleView {
    #[serde(flatten)]
    pub vehicle: Vehicle,
    /// Modelled loss in value over the coming month, if the model applies.
    pub monthly_depreciation_cents: Option<i64>,
}

impl VehicleView {
    pub fn new(vehicle: Vehicle, year_now: u16) -> Self {
        let monthly_depreciation_cents = monthly_depreciation(&vehicle.draft, year_now);
        Self { vehicle, monthly_depreciation_cents }
    }
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Estimate {
    pub low_cents: i64,
    pub mid_cents: i64,
    pub high_cents: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstimateResult {
    pub estimate: Option<Estimate>,
    /// Why no estimate could be given.
    pub reason: Option<String>,
}

impl From<Result<Estimate, String>> for EstimateResult {
    fn from(r: Result<Estimate, String>) -> Self {
        match r {
            Ok(e) => Self { estimate: Some(e), reason: None },
            Err(reason) => Self { estimate: None, reason: Some(reason) },
        }
    }
}

pub(crate) fn clean_text(raw: &str, label: &str, required: bool) -> Result<String, String> {
    let v = raw.trim();
    if (required && v.is_empty()) || v.chars().count() > MAX_TEXT || v.chars().any(char::is_control) {
        return Err(format!("{label} ist ungültig."));
    }
    Ok(v.to_string())
}

pub fn check_value(cents: i64) -> Result<i64, String> {
    if (0..=MAX_CENTS).contains(&cents) { Ok(cents) } else { Err("Der Wert ist ungültig.".into()) }
}

impl VehicleDraft {
    /// Trims text and rejects anything implausible. Nothing reaches disk unvalidated.
    pub fn validated(mut self, year_now: u16) -> Result<Self, String> {
        self.brand = clean_text(&self.brand, "Marke", true)?;
        self.model = clean_text(&self.model, "Modell", true)?;
        self.variant = clean_text(&self.variant, "Variante", false)?;
        if (self.kind == VehicleKind::Automobil) != self.drive.is_some() {
            return Err("Die Antriebsart ist ungültig.".into());
        }
        let years = 1886..=year_now + 1;
        if !years.contains(&self.build_year) {
            return Err("Das Baujahr ist ungültig.".into());
        }
        if !years.contains(&self.first_registration) || self.first_registration < self.build_year {
            return Err("Die Erstzulassung ist ungültig.".into());
        }
        if self.power_ps.is_some_and(|ps| ps == 0 || ps > 5000) {
            return Err("Die Leistung ist ungültig.".into());
        }
        if self.mileage_km.is_some_and(|km| km > 5_000_000) {
            return Err("Der Kilometerstand ist ungültig.".into());
        }
        if self.purchase_price_cents.is_some() != self.purchase_year.is_some() {
            return Err("Bitte gib Kaufpreis und Kaufjahr zusammen an.".into());
        }
        if let (Some(price), Some(year)) = (self.purchase_price_cents, self.purchase_year) {
            if price <= 0 || price > MAX_CENTS {
                return Err("Der Kaufpreis ist ungültig.".into());
            }
            if year < self.build_year || year > year_now {
                return Err("Das Kaufjahr ist ungültig.".into());
            }
        }
        if self.equipment.len() > MAX_EQUIPMENT {
            return Err("Zu viele Ausstattungsmerkmale.".into());
        }
        let mut equipment = Vec::new();
        for item in &self.equipment {
            let item = clean_text(item, "Ausstattung", false)?;
            if !item.is_empty() && !equipment.contains(&item) {
                equipment.push(item);
            }
        }
        self.equipment = equipment;
        Ok(self)
    }
}

/// Yearly loss in value for a vehicle of the given age.
fn yearly_rate(kind: VehicleKind, drive: Option<Drive>, age_years: f64) -> f64 {
    match kind {
        VehicleKind::Automobil => {
            let base = match age_years {
                a if a < 1.0 => 0.24,
                a if a < 4.0 => 0.13,
                a if a < 9.0 => 0.10,
                a if a < 16.0 => 0.08,
                _ => 0.04,
            };
            // Batteries and fast model cycles: electric cars lose value faster while young.
            if drive == Some(Drive::Elektro) && age_years < 9.0 { base + 0.03 } else { base }
        }
        VehicleKind::Motorrad => match age_years {
            a if a < 1.0 => 0.18,
            a if a < 6.0 => 0.09,
            _ => 0.05,
        },
        VehicleKind::Fahrrad => match age_years {
            a if a < 1.0 => 0.25,
            a if a < 5.0 => 0.15,
            _ => 0.08,
        },
        VehicleKind::Escooter => if age_years < 1.0 { 0.30 } else { 0.20 },
    }
}

pub(crate) fn condition_factor(c: Condition) -> f64 {
    match c {
        Condition::Schlecht => 0.75,
        Condition::Mittel => 0.90,
        Condition::Gut => 1.0,
        Condition::SehrGut => 1.08,
    }
}

/// Deviation from typical mileage: 2 % per step, limited to −15 % … +10 %.
fn mileage_factor(d: &VehicleDraft, age_years: f64) -> f64 {
    let (per_year, step) = match d.kind {
        VehicleKind::Automobil => (13_000.0, 10_000.0),
        VehicleKind::Motorrad => (4_000.0, 3_000.0),
        _ => return 1.0,
    };
    match d.mileage_km {
        Some(km) => {
            let expected = per_year * age_years.max(1.0);
            1.0 + (-(f64::from(km) - expected) / step * 0.02).clamp(-0.15, 0.10)
        }
        None => 1.0,
    }
}

/// Modelled value in cents, `extra_months` after today.
fn model_value(d: &VehicleDraft, year_now: u16, extra_months: u32) -> Result<f64, String> {
    let (Some(price), Some(purchase_year)) = (d.purchase_price_cents, d.purchase_year) else {
        return Err("Für eine Schätzung brauchen wir Kaufpreis und Kaufjahr.".into());
    };
    let age_now = year_now.saturating_sub(d.build_year);
    if age_now >= CLASSIC_AGE {
        return Err("Für Oldtimer können wir keinen seriösen Wert berechnen. Trage den Wert bitte selbst ein, zum Beispiel aus einem Gutachten.".into());
    }
    let age_at_purchase = f64::from(purchase_year.saturating_sub(d.build_year));
    let months = u32::from(year_now.saturating_sub(purchase_year)) * 12 + extra_months;
    let mut value = price as f64;
    for m in 0..months {
        let age = age_at_purchase + f64::from(m) / 12.0;
        value *= (1.0 - yearly_rate(d.kind, d.drive, age)).powf(1.0 / 12.0);
    }
    let age_then = f64::from(age_now) + f64::from(extra_months) / 12.0;
    Ok(value * condition_factor(d.condition) * mileage_factor(d, age_then))
}

pub(crate) fn round_to(cents: f64, step: i64) -> i64 {
    ((cents / step as f64).round() as i64) * step
}

pub fn estimate(d: &VehicleDraft, year_now: u16) -> Result<Estimate, String> {
    let mid = model_value(d, year_now, 0)?;
    let spread = if year_now.saturating_sub(d.build_year) > 15 { 0.20 } else { 0.12 };
    // No pseudo precision: full 100 € (10 € below 1,000 €).
    let step = if mid >= 100_000.0 { 10_000 } else { 1_000 };
    Ok(Estimate {
        low_cents: round_to(mid * (1.0 - spread), step),
        mid_cents: round_to(mid, step),
        high_cents: round_to(mid * (1.0 + spread), step),
    })
}

fn monthly_depreciation(d: &VehicleDraft, year_now: u16) -> Option<i64> {
    let now = model_value(d, year_now, 0).ok()?;
    let next = model_value(d, year_now, 1).ok()?;
    Some((now - next).round() as i64)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub fn draft() -> VehicleDraft {
        VehicleDraft {
            kind: VehicleKind::Automobil,
            drive: Some(Drive::Verbrenner),
            brand: " VW ".into(),
            model: "Golf".into(),
            variant: "GTI".into(),
            build_year: 2020,
            first_registration: 2020,
            condition: Condition::Gut,
            equipment: vec![" Navi ".into(), "".into(), "Navi".into()],
            power_ps: Some(245),
            mileage_km: None,
            purchase_price_cents: Some(4_000_000),
            purchase_year: Some(2020),
        }
    }

    pub fn sample_vehicle() -> Vehicle {
        Vehicle { id: "v1".into(), draft: draft(), created_at: 0, history: vec![], journal: vec![], next_service: None }
    }

    #[test]
    fn validation_cleans_and_rejects() {
        let ok = draft().validated(2026).unwrap();
        assert_eq!(ok.brand, "VW");
        assert_eq!(ok.equipment, vec!["Navi"]);

        let bad = |f: fn(&mut VehicleDraft)| {
            let mut d = draft();
            f(&mut d);
            d.validated(2026).is_err()
        };
        assert!(bad(|d| d.model = "  ".into()));
        assert!(bad(|d| d.drive = None));
        assert!(bad(|d| d.build_year = 1700));
        assert!(bad(|d| d.build_year = 2030));
        assert!(bad(|d| d.first_registration = 2019));
        assert!(bad(|d| d.purchase_year = None));
        assert!(bad(|d| d.purchase_year = Some(2019)));
        assert!(bad(|d| d.purchase_price_cents = Some(-5)));
        assert!(bad(|d| d.power_ps = Some(0)));
        assert!(bad(|d| d.brand = "x".repeat(61)));
        assert!(bad(|d| {
            d.kind = VehicleKind::Fahrrad;
        }));
    }

    #[test]
    fn estimate_is_a_rounded_plausible_range() {
        // 40,000 € new in 2020, six years later: 0.76 · 0.87³ · 0.90² ≈ 40.5 %.
        let e = estimate(&draft(), 2026).unwrap();
        assert_eq!(e.mid_cents, 1_620_000);
        assert!(e.low_cents < e.mid_cents && e.mid_cents < e.high_cents);
        assert_eq!(e.low_cents % 10_000, 0);
        assert_eq!(e.high_cents % 10_000, 0);

        // Bought this year: nothing has been written off yet.
        let mut fresh = draft();
        fresh.build_year = 2026;
        fresh.first_registration = 2026;
        fresh.purchase_year = Some(2026);
        assert_eq!(estimate(&fresh, 2026).unwrap().mid_cents, 4_000_000);
    }

    #[test]
    fn condition_drive_and_mileage_move_the_value() {
        let base = estimate(&draft(), 2026).unwrap().mid_cents;
        let with = |f: fn(&mut VehicleDraft)| {
            let mut d = draft();
            f(&mut d);
            estimate(&d, 2026).unwrap().mid_cents
        };
        assert!(with(|d| d.condition = Condition::Schlecht) < base);
        assert!(with(|d| d.condition = Condition::SehrGut) > base);
        assert!(with(|d| d.drive = Some(Drive::Elektro)) < base);
        assert!(with(|d| d.mileage_km = Some(200_000)) < base);
        assert!(with(|d| d.mileage_km = Some(20_000)) > base);
        // The mileage adjustment is capped.
        assert_eq!(with(|d| d.mileage_km = Some(200_000)), with(|d| d.mileage_km = Some(900_000)));
    }

    #[test]
    fn no_estimate_where_the_rule_does_not_apply() {
        let mut classic = draft();
        classic.build_year = 1966;
        classic.first_registration = 1967;
        classic.purchase_year = Some(2010);
        assert!(estimate(&classic, 2026).unwrap_err().contains("Oldtimer"));

        let mut unknown = draft();
        unknown.purchase_price_cents = None;
        unknown.purchase_year = None;
        assert!(estimate(&unknown, 2026).is_err());
        assert!(monthly_depreciation(&unknown, 2026).is_none());
    }

    #[test]
    fn monthly_depreciation_is_positive_and_small() {
        let m = monthly_depreciation(&draft(), 2026).unwrap();
        let value = estimate(&draft(), 2026).unwrap().mid_cents;
        assert!(m > 0 && m < value / 50, "{m}");
    }

    #[test]
    fn dates_must_exist() {
        for ok in ["2026-11-16", "2024-02-29", "1900-01-01"] {
            assert!(check_date(ok).is_ok(), "{ok}");
        }
        for bad in ["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-1-1", "16.11.2026", "", "2026-11-16T10:00", "+026-11-16", "1899-12-31"] {
            assert!(check_date(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn journal_entries_are_validated() {
        let entry = |category, amount_cents, km| JournalDraft { date: "2026-03-01".into(), category, amount_cents, km, note: " TÜV ".into() };
        assert_eq!(entry(JournalCategory::Werkstatt, Some(12_000), None).validated().unwrap().note, "TÜV");
        assert!(entry(JournalCategory::Fahrt, None, Some(320)).validated().is_ok());
        assert!(entry(JournalCategory::Fahrt, None, None).validated().is_err(), "a trip needs km");
        assert!(entry(JournalCategory::Steuer, None, None).validated().is_err(), "a cost needs an amount");
        assert!(entry(JournalCategory::Steuer, Some(-1), None).validated().is_err());
        let mut long = entry(JournalCategory::Teile, Some(1), None);
        long.note = "x".repeat(201);
        assert!(long.validated().is_err());
    }

    #[test]
    fn older_vault_data_without_journal_still_loads() {
        let json = serde_json::to_string(&sample_vehicle()).unwrap();
        let stripped = json.replace(",\"journal\":[]", "").replace(",\"nextService\":null", "");
        assert_ne!(json, stripped);
        let v: Vehicle = serde_json::from_str(&stripped).unwrap();
        assert!(v.journal.is_empty() && v.next_service.is_none());
    }

    #[test]
    fn value_bounds() {
        assert!(check_value(0).is_ok());
        assert!(check_value(-1).is_err());
        assert!(check_value(MAX_CENTS + 1).is_err());
    }
}
