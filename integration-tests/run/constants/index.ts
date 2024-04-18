const ANDROID_XPATHS = {
  PRIVACY_TOGGLE: `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.view.ViewGroup/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.LinearLayout[5]/android.widget.RelativeLayout/android.widget.TextView[2]`,
  FIRST_GIF: `(//XCUIElementTypeImage[@name="gif cell"])[1]`,
  VIDEO_TOGGLE: `//XCUIElementTypeStaticText[@name="Videos"]`,
  VOICE_TOGGLE: `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout[2]/android.widget.Button[1]`,
};

export { ANDROID_XPATHS };
