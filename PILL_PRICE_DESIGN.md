# Pill-Shaped Price Design

## Visual Change

Updated the task card price badge to be a **pill-shaped container** that sits on the **top border** of the card, with half above and half below the border.

## Design Changes

### Before
```
┌─────────────────┐
│  💰 5          │ ← Badge on top-left corner inside card
│   ┌─────────┐  │
│   │  Image  │  │
│   └─────────┘  │
│                │
│   Task Title   │
└─────────────────┘
```

### After
```
      💰 5        ← Pill badge centered on top border
   ───────────       (half above, half below)
┌─────────────────┐
│   ┌─────────┐  │
│   │  Image  │  │
│   └─────────┘  │
│                │
│   Task Title   │
└─────────────────┘
```

## CSS Changes

### 1. Card Container
```css
.task-card {
  overflow: visible;      /* Allow pill to overflow card bounds */
  margin-top: 25px;      /* Space for the pill badge */
  position: relative;
}
```

### 2. Pill Badge
```css
.task-coins {
  /* Positioning */
  position: absolute;
  top: -20px;                    /* Half outside card (40px pill height / 2) */
  left: 50%;                     /* Center horizontally */
  transform: translateX(-50%);   /* Perfect centering */
  
  /* Pill shape */
  border-radius: 50px;           /* Fully rounded (pill shape) */
  padding: 10px 24px;            /* Horizontal padding for pill effect */
  
  /* Visual styling */
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border: 3px solid var(--blue-dark);
  box-shadow: 0 8px 25px rgba(255, 215, 0, 0.7);
  
  /* Content */
  font-size: 1.3em;
  font-weight: 800;
  gap: 8px;
  white-space: nowrap;
  z-index: 10;
}
```

### 3. Grid Padding
```css
.task-grid {
  padding-top: 10px;  /* Extra space at top for pills */
}
```

## Visual Features

### Pill Shape
- **Border radius**: `50px` (fully rounded ends)
- **Padding**: `10px 24px` (horizontal padding creates pill effect)
- **Height**: ~40px (auto-calculated from padding + font size)

### Positioning
- **Centered horizontally**: `left: 50%; transform: translateX(-50%)`
- **Straddling border**: `top: -20px` (half of 40px height is outside)
- **Overflow enabled**: `overflow: visible` on card allows badge to extend beyond bounds

### Visual Effects
- **Gradient background**: Gold to orange (#FFD700 → #FFA500)
- **Dark border**: 3px solid blue-dark for contrast
- **Strong shadow**: Large glow effect (0 8px 25px)
- **Z-index**: 10 to appear above image

## Advantages

### Visual Impact
✅ **Eye-catching**: Price immediately visible
✅ **Clean separation**: Sits between sections
✅ **Modern design**: Pill shape is contemporary
✅ **Symmetrical**: Centered for balance

### Practical
✅ **Doesn't obscure image**: Not overlaid on content
✅ **Consistent positioning**: Same spot on all cards
✅ **Scalable**: Works with different price lengths
✅ **Hover compatible**: Moves with card on hover

## Responsive Behavior

The pill maintains its position relative to the card border on all screen sizes:

```css
/* Hover effect - card moves up, pill moves with it */
.task-card:hover {
  transform: translateY(-8px);
}
```

The pill moves with the card because it's positioned relative to the card container.

## Example

### Single digit price
```
   💰 5
 ─────────
```

### Double digit price
```
   💰 15
 ──────────
```

### Large price
```
   💰 250
 ───────────
```

The pill expands horizontally to fit the content while maintaining the pill shape.

## Browser Rendering

### HTML Structure
```html
<div class="task-card">
  <div class="task-coins">
    <Coins size={20} />
    <span>5</span>
  </div>
  <img class="task-image" src="..." />
  <div class="task-content">
    <div class="task-title">Clean Kitchen</div>
    ...
  </div>
</div>
```

### Rendering Order
1. Card with margin-top creates space
2. Pill badge positioned absolutely at top: -20px
3. Image below the pill
4. Content below the image

## Testing Checklist

To verify the design:

- [ ] Pill is centered on top border
- [ ] Half of pill is above card border
- [ ] Half of pill is below card border
- [ ] Pill doesn't overlap image content
- [ ] Pill has rounded pill shape (not just rounded corners)
- [ ] Pill moves with card on hover
- [ ] Design works on different screen sizes
- [ ] Works with various price lengths (1-3 digits)

## Visual Measurements

```
Pill dimensions:
- Height: ~40px (padding + content)
- Min width: ~80px (for small prices)
- Max width: ~120px (for large prices)
- Border radius: 50px (fully rounded)
- Border: 3px
- Shadow blur: 25px

Positioning:
- top: -20px (half of 40px height)
- Card margin-top: 25px (pill height + buffer)
- Grid padding-top: 10px (extra spacing)
```

## Color Palette

### Pill Colors
- **Background gradient**: 
  - Start: `#FFD700` (Gold)
  - End: `#FFA500` (Orange)
- **Border**: `var(--blue-dark)` (#0a1628)
- **Text**: `var(--blue-dark)` (dark blue for contrast)
- **Shadow**: `rgba(255, 215, 0, 0.7)` (golden glow)

### Contrast
The dark blue text on gold/orange gradient ensures excellent readability.

## Summary

✅ **Implemented:**
- Pill-shaped price badge
- Centered on top border
- Half above, half below border
- Overflow enabled for proper rendering
- Proper spacing and margins

🎨 **Visual Result:**
- Modern, clean design
- Eye-catching price display
- Professional appearance
- Consistent with design trends

---

*Last Updated: November 2025*
