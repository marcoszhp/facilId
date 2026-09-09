const { withAndroidManifest } = require('expo/config-plugins');
module.exports = config => withAndroidManifest(config, config => {
  const manifest = config.modResults.manifest;
  manifest.queries ||= [{}];
  manifest.queries[0].intent ||= [];
  // Android 11+ precisa enxergar o serviço de síntese de voz instalado.
  if (!manifest.queries[0].intent.some(intent => intent.action?.some(action => action.$?.['android:name'] === 'android.intent.action.TTS_SERVICE'))) {
    manifest.queries[0].intent.push({action:[{$:{'android:name':'android.intent.action.TTS_SERVICE'}}]});
  }
  manifest['uses-feature'] ||= [];
  for (const feature of ['android.hardware.nfc', 'android.hardware.camera']) {
    const found = manifest['uses-feature'].find(item => item.$?.['android:name'] === feature);
    if (found) found.$['android:required'] = 'false';
    else manifest['uses-feature'].push({$:{'android:name':feature,'android:required':'false'}});
  }
  return config;
});
