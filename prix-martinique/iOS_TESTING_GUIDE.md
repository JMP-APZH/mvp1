# iOS Testing Guide - App6.jsx HybridBarcodeScanner

## Test Date: [To be filled]
## Tester: [iPhone user name]
## Device: [iPhone model + iOS version]

---

## Pre-Test Checklist

- [ ] App deployed to production (Vercel)
- [ ] PWA installed on iPhone
- [ ] Camera permissions granted

---

## Test Scenarios

### Scenario 1: QuaggaJS Auto-Scan
**Steps**:
1. Open app
2. Navigate to "Scanner" tab
3. Point at barcode
4. Wait up to 3 seconds

**Expected**:
- Camera preview visible
- Barcode auto-detected
- Form auto-fills

**Actual Result**: ______________________

**Success**: ☐ Yes ☐ No

---

### Scenario 2: Native Fallback
**Steps**:
1. Open scanner
2. Wait 3+ seconds (or click "Saisir manuellement")
3. Click "Ouvrir la caméra"
4. Take photo of barcode
5. Enter numbers manually

**Expected**:
- Fallback UI appears
- Camera opens
- Photo captured
- Manual entry works

**Actual Result**: ______________________

**Success**: ☐ Yes ☐ No

---

### Scenario 3: Direct Manual Entry
**Steps**:
1. Open scanner
2. Click "Saisir manuellement"
3. Enter barcode (e.g., 3017620422003)
4. Click "Valider"

**Expected**:
- Manual input shown immediately
- Numbers accepted
- Form filled on submit

**Actual Result**: ______________________

**Success**: ☐ Yes ☐ No

---

## User Experience Questions

1. Was it clear what to do? ☐ Yes ☐ No
2. Was it frustrating? ☐ Yes ☐ No
3. Preferred method: ☐ Auto-scan ☐ Photo ☐ Manual
4. Would you use this regularly? ☐ Yes ☐ No
5. Any suggestions? ______________________

---

## Issues Encountered

[List any bugs, errors, or confusing behavior]

---

## Overall Rating

Scanner Experience: ☐ Excellent ☐ Good ☐ Acceptable ☐ Poor

---

## Recommendation

Should we:
- [ ] Keep this solution (good enough)
- [ ] Consider commercial SDK (too frustrating)
- [ ] Needs minor improvements (list below)

---

## Notes

[Any additional observations]
