package app.stylup.proto;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemTextSize();
    }

    @Override
    public void onResume() {
        super.onResume();
        applySystemTextSize();
    }

    // Le texte de l'app suit le réglage Android « Taille de police » (comme les apps natives)
    private void applySystemTextSize() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        float scale = getResources().getConfiguration().fontScale;
        getBridge().getWebView().getSettings().setTextZoom(Math.round(scale * 100));
    }
}
