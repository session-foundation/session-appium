import { XPath } from '../types/testing';

export const ANDROID_XPATHS: { [key: string]: XPath } = {
  PRIVACY_TOGGLE: `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.view.ViewGroup/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/androidx.recyclerview.widget.RecyclerView/android.widget.LinearLayout[5]/android.widget.RelativeLayout/android.widget.TextView[2]`,
  FIRST_GIF: `(//android.widget.ImageView[@resource-id="network.loki.messenger:id/thumbnail"])[1]`,
  VOICE_TOGGLE: `/hierarchy/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout[2]/android.widget.Button[1]`,
  BROWSE_BUTTON: `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.ScrollView/android.widget.TabHost/android.widget.LinearLayout/android.widget.FrameLayout/androidx.viewpager.widget.ViewPager/android.widget.RelativeLayout/android.widget.GridView/android.widget.LinearLayout/android.widget.LinearLayout[2]`,
  MODAL_DESCRIPTIONS: `/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/androidx.appcompat.widget.LinearLayoutCompat/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.TextView[2]`,
};

export const IOS_XPATHS: { [key: string]: XPath } = {
  VIDEO_TOGGLE: `//XCUIElementTypeStaticText[@name="Videos"]`,
  FIRST_GIF: `(//XCUIElementTypeImage[@name="gif cell"])[1]`,
  PASTE: `//XCUIElementTypeStaticText[@name="Paste"]`,
  INVITE_A_FRIEND_SHARE: `//XCUIElementTypeOther[contains(@label, "Hey,")][1]`,
};

export { longText } from '../shared/constants';

export { testLink } from '../shared/constants';

export const DEVNET_URL = 'http://sesh-net.local:1280';

export const PRO_BACKEND_URL = 'https://pro.session.codes';

export const ONS_MAPPINGS = {
  TESTQA: {
    ons: 'testqa',
    pubkey: '05df4a36db2dea751b359ea104c7f310b33e743f455763b9daad90603829f4a535',
  },
};
