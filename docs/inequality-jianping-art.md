# 建平主题插画更新

根据用户提供的校服与苹果雕塑照片制作，使用内置 imagegen；输出为透明背景插画，原始照片不作为网页素材。

## 已使用资源

- `assets/images/inequality-review/student-jianping.png`：灰色藏蓝校服人物，去除身前纸张。
- `assets/images/inequality-review/jianping-apple.png`：金色苹果雕塑、白色基座与花草。

## 最终提示词

### 校服人物

Use case: identity-preserve / illustration-story. Asset type: transparent educational website corner character.
Input image 1 is the cartoon character EDIT TARGET. Input image 2 is a CLOTHING REFERENCE ONLY, not a face or person reference.
Edit the cartoon boy from image 1: preserve his friendly cartoon face, huge brown eyes, brown hair, smiling expression, two thumbs-up pose, warm colors, polished clean illustrated shading and proportions. Completely remove the large white paper in front of him. Reconstruct the unobscured torso and both arms naturally; no paper, sign, card, text, formula, white box, or other object in front of the boy.
Replace the royal-blue hoodie and backpack with the school uniform shown in image 2: light heather-gray short-sleeve polo shirt, gray turn-down collar with dark navy piping, dark navy inset panels along the sides under the arms, a small round light-blue school badge on the left chest without any readable lettering, navy athletic trousers with two narrow white side stripes. Add a simple navy-blue baseball cap matching the uniform reference, retaining some visible brown hair. Remove the backpack and hoodie entirely.
Show the boy from cap to hips, with shirt clearly visible, all of both hands and cap inside frame. Maintain original cheerful illustrated style, not photorealism. Closely framed with small transparent margins. Genuine transparent background and clean alpha; no background scene or decorative shape.

### 人物透明背景修整

Use case: background-extraction. Edit the supplied cartoon boy image: remove the ENTIRE background including every dark blue, black, gray and orange glow / halo outside the character. The result must be an isolated cutout on a genuine fully transparent alpha channel. Preserve the boy exactly: navy baseball cap, brown hair, eyes, cheerful face, gray school polo with navy side panels and circular light-blue badge, navy striped trousers, both thumbs-up hands, proportions, pose, crisp illustration style. Change only the background. No colored shadow, no glow, no backdrop, no white matte, no checkerboard baked into the image. All pixels outside the character silhouette must be transparent, including gaps between arms and torso. Keep the same portrait composition, head to hips.

### 苹果雕塑

Use case: stylized-concept. Asset type: transparent educational website bottom-right landmark illustration.
Input image 1 is the SUBJECT / GEOMETRY reference: the iconic Jianping school golden apple sculpture. Input image 2 is a STYLE / RENDERING reference only, for clean colorful softly shaded illustrated volume. Create a completely newly rendered illustration of ONLY the golden apple sculpture and its low white stone pedestal, with a small elegant cluster of green foliage and tiny pink-purple flowers around the base. Do not paste, trace photo pixels, or use a photographic crop. Do not reproduce the school building, sky, people, books, pencils, or plant pot.
Faithfully match the unusual actual sculpture silhouette and orientation in photo 1: a huge smooth round golden apple lying on its side, broad rounded spherical upper body, gently flattened lower resting area, the deep dimple/core visible on the lower LEFT-facing side, tiny brown central detail in that dimple, not at the top. No upright stem and no leaf attached to the apple. Gold/ochre lower shading and soft pale-gold highlight at upper left. The sculpture rests on a low clean pale ivory rectangular plinth. Three-quarter view matching photo 1, sculpture dominates the composition.
Polished bright cartoon illustration with subtle soft 3D volume and crisp readable contours, consistent with the supplied website asset; warm golden yellow, ivory, tasteful purple flowers and green leaves, no photorealistic texture. Full sculpture and entire pedestal in frame, compact approximately square composition, little surrounding empty margin. True transparent background with clean alpha. No labels, text, watermark, rectangular background, surrounding campus or extra props.

