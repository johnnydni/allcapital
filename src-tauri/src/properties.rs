//! Real estate: validation and the linear depreciation for tax purposes.
//!
//! There is deliberately no value estimate: property prices depend on the
//! exact location, and a rule of thumb would be wrong by tens of thousands.
//! The user enters the value (purchase price, appraisal, offer).

use crate::vehicles::{clean_text, ValuePoint, MAX_CENTS};
use serde::{Deserialize, Serialize};

pub const MAX_PROPERTIES: usize = 100;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PropertyKind {
    Haus,
    Wohnung,
    Garage,
    Gewerbe,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PropertyDraft {
    pub kind: PropertyKind,
    pub name: String,
    pub street: String,
    pub postal_code: String,
    pub city: String,
    pub state: String,
    pub build_year: Option<u16>,
    pub living_area_m2: Option<u32>,
    pub plot_area_m2: Option<u32>,
    pub rooms: Option<f64>,
    pub bathrooms: Option<u16>,
    pub purchase_price_cents: Option<i64>,
    pub purchase_year: Option<u16>,
    pub rented: bool,
    /// Share of the purchase price attributable to the building (not the land), 1–100.
    pub building_share_percent: Option<u8>,
    pub next_renovation_year: Option<u16>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Property {
    pub id: String,
    #[serde(flatten)]
    pub draft: PropertyDraft,
    pub created_at: u64,
    pub history: Vec<ValuePoint>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PropertyView {
    #[serde(flatten)]
    pub property: Property,
    /// Linear depreciation (AfA) for the current year, if it applies.
    pub yearly_afa_cents: Option<i64>,
    /// AfA rate in basis points, e.g. 200 = 2 %.
    pub afa_rate_bp: Option<u32>,
}

impl PropertyView {
    pub fn new(property: Property, year_now: u16) -> Self {
        let afa = yearly_afa(&property.draft, year_now);
        Self { yearly_afa_cents: afa.map(|a| a.0), afa_rate_bp: afa.map(|a| a.1), property }
    }
}

impl PropertyDraft {
    pub fn validated(mut self, year_now: u16) -> Result<Self, String> {
        self.name = clean_text(&self.name, "Bezeichnung", true)?;
        self.street = clean_text(&self.street, "Straße", false)?;
        self.city = clean_text(&self.city, "Ort", false)?;
        self.state = clean_text(&self.state, "Bundesland", false)?;
        self.postal_code = self.postal_code.trim().to_string();
        if !self.postal_code.is_empty()
            && (self.postal_code.len() > 10 || !self.postal_code.chars().all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '-'))
        {
            return Err("Die Postleitzahl ist ungültig.".into());
        }
        let years = 1000..=year_now + 5;
        if self.build_year.is_some_and(|y| !years.contains(&y)) {
            return Err("Das Baujahr ist ungültig.".into());
        }
        if self.living_area_m2.is_some_and(|a| a == 0 || a > 1_000_000) || self.plot_area_m2.is_some_and(|a| a == 0 || a > 100_000_000) {
            return Err("Die Fläche ist ungültig.".into());
        }
        if self.rooms.is_some_and(|r| !(r > 0.0 && r <= 1000.0 && (r * 2.0).fract() == 0.0)) {
            return Err("Die Zimmerzahl ist ungültig (ganze oder halbe Zimmer).".into());
        }
        if self.bathrooms.is_some_and(|b| b > 1000) {
            return Err("Die Anzahl der Badezimmer ist ungültig.".into());
        }
        if self.purchase_price_cents.is_some() != self.purchase_year.is_some() {
            return Err("Bitte gib Kaufpreis und Kaufjahr zusammen an.".into());
        }
        if let (Some(price), Some(year)) = (self.purchase_price_cents, self.purchase_year) {
            if price <= 0 || price > MAX_CENTS {
                return Err("Der Kaufpreis ist ungültig.".into());
            }
            if year < 1900 || year > year_now {
                return Err("Das Kaufjahr ist ungültig.".into());
            }
        }
        if self.building_share_percent.is_some_and(|p| p == 0 || p > 100) {
            return Err("Der Gebäudeanteil ist ungültig.".into());
        }
        if !self.rented {
            self.building_share_percent = None;
        }
        if self.next_renovation_year.is_some_and(|y| y < year_now || y > year_now + 100) {
            return Err("Das Jahr der nächsten Renovierung ist ungültig.".into());
        }
        Ok(self)
    }
}

/// Linear AfA for rented buildings (§ 7 Abs. 4 EStG): 2.5 % for buildings
/// completed before 1925, 3 % for completion after 2022, otherwise 2 %.
/// The base is the building's share of the purchase price; land is never
/// depreciated. Returns (amount for `year_now` in cents, rate in basis points).
///
/// Simplifications, stated in the UI: full-year amounts (no pro-rata for the
/// purchase year), no special or declining-balance depreciation.
pub fn yearly_afa(d: &PropertyDraft, year_now: u16) -> Option<(i64, u32)> {
    if !d.rented {
        return None;
    }
    let price = d.purchase_price_cents?;
    let purchase_year = d.purchase_year?;
    let share = d.building_share_percent?;
    let build_year = d.build_year?;
    let rate_bp: u32 = match build_year {
        y if y < 1925 => 250,
        y if y >= 2023 => 300,
        _ => 200,
    };
    let base = price as i128 * share as i128 / 100;
    let yearly = (base * rate_bp as i128 / 10_000) as i64;
    let elapsed = i64::from(year_now.saturating_sub(purchase_year));
    let already = yearly * elapsed;
    let remaining = base as i64 - already;
    if yearly <= 0 || remaining <= 0 {
        return None;
    }
    Some((yearly.min(remaining), rate_bp))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft() -> PropertyDraft {
        PropertyDraft {
            kind: PropertyKind::Haus,
            name: " Holiday House ".into(),
            street: "Bergstr. 7".into(),
            postal_code: "82319".into(),
            city: "Starnberg".into(),
            state: "Bayern".into(),
            build_year: Some(2009),
            living_area_m2: Some(180),
            plot_area_m2: Some(430),
            rooms: Some(6.0),
            bathrooms: Some(2),
            purchase_price_cents: Some(40_000_000),
            purchase_year: Some(2020),
            rented: true,
            building_share_percent: Some(75),
            next_renovation_year: Some(2031),
        }
    }

    #[test]
    fn validation() {
        let ok = draft().validated(2026).unwrap();
        assert_eq!(ok.name, "Holiday House");
        let bad = |f: fn(&mut PropertyDraft)| {
            let mut d = draft();
            f(&mut d);
            d.validated(2026).is_err()
        };
        assert!(bad(|d| d.name = " ".into()));
        assert!(bad(|d| d.postal_code = "<b>".into()));
        assert!(bad(|d| d.rooms = Some(2.3)));
        assert!(bad(|d| d.rooms = Some(f64::NAN)));
        assert!(bad(|d| d.rooms = Some(0.0)));
        assert!(bad(|d| d.purchase_year = None));
        assert!(bad(|d| d.building_share_percent = Some(0)));
        assert!(bad(|d| d.next_renovation_year = Some(2020)));
        let mut half = draft();
        half.rooms = Some(2.5);
        assert!(half.validated(2026).is_ok());
        let mut own = draft();
        own.rented = false;
        assert!(own.validated(2026).unwrap().building_share_percent.is_none());
    }

    #[test]
    fn afa_follows_the_statutory_rates() {
        // 400,000 € · 75 % building share · 2 % = 6,000 € per year.
        assert_eq!(yearly_afa(&draft(), 2026), Some((600_000, 200)));
        let with = |f: fn(&mut PropertyDraft)| {
            let mut d = draft();
            f(&mut d);
            yearly_afa(&d, 2026)
        };
        assert_eq!(with(|d| d.build_year = Some(1910)), Some((750_000, 250)));
        assert_eq!(with(|d| d.build_year = Some(2024)), Some((900_000, 300)));
        assert_eq!(with(|d| d.rented = false), None);
        assert_eq!(with(|d| d.building_share_percent = None), None);
        // Fully written off after 50 years at 2 %.
        assert_eq!(with(|d| d.purchase_year = Some(1960)), None);
    }
}
