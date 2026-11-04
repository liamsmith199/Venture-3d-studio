# Venture 3D Studio: Student Guide

You don't need any 3D experience. The studio opens with your doctor mascot, ready to edit.

## 1. Add your concept image

1. Open the **Import** tab on the left and click **Add your Mission 1 images**.
2. Label each image as Front, Side, Back or Other. One image showing all views can use Other.
3. Check the description and the type of object.
4. To set the real size, type a height and press **Apply**.

Your image stays visible in the top-right corner of the 3D view. It is only a picture to compare against. The 3D model is the set of parts on the left.

## 2. Explore

| To do this | Do this |
| --- | --- |
| Look around | Drag in the 3D view |
| Zoom | Scroll, or pinch on a trackpad |
| Slide the view | Right-drag, or turn on the hand button |
| Jump to an angle | Front, Side, Back, Top or Isometric |
| Compare to a flat drawing | Flat |
| See the whole model again | Reset view |

## 3. Select a part

Click the model, or choose a part in the **Objects** tab. The first click selects a whole area, such as Hair. Click again to step into a single piece. Double-click a name in the list to zoom to it.

## 4. Change your design

With a part selected, use the panel on the right:

- **Size:** type under **Dimensions**, or use **Resize** and drag the handles. The lock button chooses whether all sides resize together.
- **Position and turn:** use **Move** or **Turn** and drag in the 3D view, or type exact numbers.
- **Color:** use the color box or the swatches. On a group such as Lab coat, this changes every piece inside it.
- **Material:** choose Matte, Glossy, Ceramic, Fabric, Metal, Brushed, Gold or Glass, or use the sliders.
- **Logo or pattern:** open **Images and branding**. **Wrap image** covers the part, and **Add sticker** makes a movable logo.
- **Add parts:** use **Add a part** in the Objects tab. Duplicate, reset, or delete with the buttons under the part name.
- **Lighting and background:** these are at the bottom of the panel, or right there when nothing is selected.
- **Hotspots (optional):** the pin button adds a labelled feature for your website.

Made a mistake? Press **Undo** (Ctrl+Z). The reset button returns one part to how it started.

Want a different start? The **Templates** tab has seven editable designs. Your current design is kept under Project > Saved versions when you switch.

## 5. Save your work

- The studio autosaves in this browser, and **Save** (Ctrl+S) saves right away.
- **Save version** in the Project tab keeps a point you can return to.
- **Export Project** downloads a backup file. **Do this before you finish**, because browser saves can be lost if site data is cleared or you change computers. **Import Project** opens the backup.

## 6. Review and confirm

1. Press **Review** to see your model turning slowly without tools, then press **Exit review**.
2. Turn the model to the angle you like best. Confirm Model saves this view for your website.
3. Press **Confirm Model** and wait for the checks to finish.
4. Press **Download Venture_3D_Confirmed_Handoff.zip**.

If a check fails, you'll see what went wrong and no file is created. Fix the problem and confirm again. Confirming never publishes anything or changes your venture website.

## What to carry into Mission 3

Keep **Venture_3D_Confirmed_Handoff.zip**. It contains:

| File | What it is |
| --- | --- |
| `model.glb` | Your 3D model, with its images stored inside |
| `model-manifest.json` | Size, camera view, lighting, hotspots and checksums |
| `project.json` | Editable copy that opens with Import Project |
| `preview.png` | A picture rendered from the model |
| `README.txt` | Instructions for adding it to your website |

To check a model on its own, open `viewer.html` on the studio's website and choose your `model.glb`.
