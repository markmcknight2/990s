# Nonprofit 990 Research

Financial and governance data for 4,985 nonprofit organizations,
read from their IRS Form 990 filings.

**Live site:** https://markmcknight2.github.io/990s/

- [Board Explorer](https://markmcknight2.github.io/990s/Chattanooga_Board_Explorer.html) - the full dashboard
- [Ask about nonprofits](https://markmcknight2.github.io/990s/Nonprofit_Questions.html)
- [Organization profiles](https://markmcknight2.github.io/990s/org-pages/)
- [ANCA members](https://markmcknight2.github.io/990s/ANCA_Members_Explorer.html)
- [IRS-classified botanical organizations](https://markmcknight2.github.io/990s/C41_Botanical_Universe_Explorer.html)
- [Environmental education organizations](https://markmcknight2.github.io/990s/C60_Environmental_Education_Explorer.html)
- [Civic design centers](https://markmcknight2.github.io/990s/Civic_Design_Centers_Explorer.html)
- [Forest and nature schools](https://markmcknight2.github.io/990s/Forest_Nature_Schools_Explorer.html)
- [Nature centers](https://markmcknight2.github.io/990s/Nature_Centers_Explorer.html)
- [Public gardens](https://markmcknight2.github.io/990s/Public_Gardens_Explorer.html)
- [Symphony orchestras](https://markmcknight2.github.io/990s/Symphony_Orchestras_Explorer.html)

Data built 2026-09-25 16:10.

## About this repository

Everything here is generated. The pages are built on a local machine from the
IRS Form 990 bulk e-file archive and published with a single step; editing a
file here by hand will be overwritten by the next publish.

- Organization pages share their stylesheet, chart code and peer data through
  `assets/`, so each page is small. They need the rest of the site to render
  and are not meant to be saved individually.
- `.github/workflows/check.yml` runs `.github/check_site.py` on every push: it
  confirms each page parses, every asset it references exists, and a sample of
  cohorts rebuilds to the figures the build recorded.

## Sources

All figures derive from public sources: IRS Form 990 filings (IRS e-file bulk
XML), organizations' own websites, and IRS Exempt Organizations Select Check.
Figures are reported on each organization's own fiscal year, which does not
always align to the calendar year.
