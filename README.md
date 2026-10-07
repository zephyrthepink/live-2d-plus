# Live2D+

A Live2D companion for SillyTavern. Make your character speak along with TTS, show captions, and react to emotions, actions, and taps.

## Features

- **TTS lip-sync:** the model's mouth follows your SillyTavern TTS audio.
- **Captions:** highlight the original TTS text as it plays, with optional Vosk recognition for timing.
- **Emotion and action cues:** analyze the spoken text and play the motions or expressions you assign.
- **Tap interactions:** click or tap the model to play a motion, change an expression, or add a chat message.
- **Dragging:** move the model with touch, mouse, or pen, including on phones and tablets.
- **Appearance:** adjust size, placement, captions, transparency, and visual filters.
- **Settings for each model:** switching models restores their saved configuration.

## Installation

1. Copy `https://github.com/zephyrthepink/live-2d-plus`.
2. Open SillyTavern's **Extensions** menu.
3. Click **Install extension**, paste the URL, and install.
4. Refresh SillyTavern and open **Live2D+** in the extension settings.

## Getting started

1. Turn on **Enable Live2D**.
2. Under **Model**, choose **Default** to try the demo, **URL** to load a model link, or **Library** to select a local model.
3. Set up SillyTavern's **TTS** extension and play a message. Live2D+ uses that audio for lip-sync.
4. Drag the model into place. Use **Rendering** for size and position, and **Pointer & Dragging** for cursor tracking.

For local models, put each complete model folder here:

```text
SillyTavern/data/<user-handle>/assets/live2d/<model-folder>/
```

Keep its `.model.json` or `.model3.json` file and supporting files together. Choose **Library → Refresh Models**, then select it. The Default demo needs internet access.

## Captions and Vosk

Turn on **Captions → Enable captions** and adjust the style and placement.

For speech recognition timing:

1. Open **Speech-to-Text (Vosk)**.
2. Turn on **Enable STT timestamps**.
3. Leave **Vosk model URL** empty to use the included English model.
4. Click **Load Vosk model** and wait until it is ready. Load it again after refreshing SillyTavern.

Vosk transcribes TTS audio in your browser. Captions keep the original wording; misheard words get estimated timing. Without Vosk, captions use estimated timing throughout. See [the Vosk model guide](models/README.md) for other languages.

## Emotions and actions

For optional reactions, enable **Dynamic Analysis → Dynamic cue mode** and choose a source:

- **Custom:** enter an OpenAI-compatible URL and optional key, then fetch and select a model. Include `/v1` if your provider requires it.
- **Connection Profile:** use an existing SillyTavern connection profile.
- **SillyTavern built-in classifier:** use its configured classifier for one emotion per message.

Assign motions or expressions under **Emotion mappings**. Map **Neutral** for fallback reactions.

Custom and Connection Profile analysis also support additional emotions and **Action mappings**. **Cue priority** controls which mapping wins. **Reload model after playback** clears lingering expressions and motions.

Preview available cues with **Motion & Expression Test → Play Selected**.

## Tap interactions

Enable **Tap Interactions** and assign a motion, expression, or message to **Default tap** or a specific hit area.

**Auto-send interaction** sends the message; **Allow spam click** lets repeated taps restart motions. Dragging does not trigger taps.

## Fixing common problems

- **Model missing:** keep its supporting files together, then refresh the Library or use **Reload Model**.
- **No captions timing from Vosk:** load the recognition model and wait until it is ready.
- **Analysis returns 404:** check the API URL and model name. Custom analysis adds `/chat/completions` to your URL.
- **No emotion animation:** assign a motion or expression to that emotion and enable the corresponding cue source.

## Credits

Author: **ZephyrThePink**. Extension license: [AGPL-3.0](LICENSE). Bundled dependency and asset notices: [Third-party notices](THIRD_PARTY_NOTICES.md).
