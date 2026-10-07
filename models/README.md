# Vosk speech models

Vosk transcribes SillyTavern's TTS audio in your browser and provides word timestamps. Live2D+ uses these to time the original caption text, even when recognition mishears words. It does not use your microphone.

These are speech-recognition models, separate from Live2D character models.

## Included English model

`vosk-model-small-en-us-0.15.tar.gz` is included and ready to use:

1. Open **Live2D+ → Speech-to-Text (Vosk)**.
2. Turn on **Enable STT timestamps**.
3. Leave **Vosk model URL** empty.
4. Click **Load Vosk model** and wait until it is ready.

Load it again after refreshing SillyTavern.

## Another language or model

1. Download a model for your TTS language from the [Vosk model list](https://alphacephei.com/vosk/models).
2. If it is a `.zip`, extract it and compress the complete model folder as **`.tar.gz`**. Renaming the extension does not convert it.
3. Put the archive in this extension's `models/` folder.
4. Set **Vosk model URL** to:

   ```text
   /scripts/extensions/third-party/<installed-folder>/models/<your-model>.tar.gz
   ```

5. Replace the placeholders with your folder and archive names, then click **Load Vosk model** or **Reload Vosk model**.

To create the archive in a terminal:

```sh
tar -czf my-vosk-model.tar.gz my-vosk-model
```

## Loading problems

Open the model URL in your browser: it should download the archive. Check the path and archive contents if loading fails. Larger models use more memory and take longer to load.

Captions still work with estimated timing when Vosk is unavailable.
