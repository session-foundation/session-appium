import type { DesktopWrapper } from '../../../desktop/DesktopWrapper';
import type { StrategyExtractionObj } from '../../../desktop/types';

import {
  Global,
  LeftPane,
  ProNonOriginating,
  ProSettings,
  Settings,
} from '../../../desktop/locators';
import { test_Alice_1W_no_network } from '../../../desktop/sessionTest';
import { tStripped } from '../../../localizer/lib';
import { REFUND_URL_FRAGMENT } from '../../../shared/constants';

/**
 * Which refund route Desktop offers, for each plan it can be looking at.
 *
 * Desktop can never be the platform a plan was bought on, so every refund starts here and the only
 * question is where it sends the user: to the store's own policies, to the store account that bought
 * the plan, or to Session Support. The app picks from the payment provider and whether the store's
 * refund window is still open — both of which a mocked fixture has to state, since it has no payment.
 *
 * Nothing here reaches the network: the provider, the window and the proof are all mocked, and
 * `proLoadingState: 'success'` suppresses the startup fetch that would otherwise overwrite them.
 *
 * Every text assertion is a run of copy with no `<br/>` in it. `tStripped` collapses a break to a
 * space while the DOM renders it as no character at all, so a string spanning one can never match.
 */

const PRESENT_MAX_WAIT = 10_000;

/** The three routes, so each spec can assert the two it did not expect are absent. */
const REFUND_ROUTES = [
  ProNonOriginating.refundPlatformAccount,
  ProNonOriginating.refundSessionSupport,
  ProNonOriginating.refundStorePolicies,
] as const;

async function openRefundPage(alice: DesktopWrapper): Promise<void> {
  await alice.clickOn(LeftPane.settingsButton);
  await alice.clickOn(Settings.proMenuItem);
  await alice.waitForElement({
    locator: ProSettings.manageHeader,
    options: { maxWaitMs: PRESENT_MAX_WAIT },
  });
  await alice.clickOn(ProSettings.requestRefundRow);
  // The non-originating pages all share this hero slot, so its copy is what says we are on the refund
  // one rather than cancel or update.
  await alice.waitForElement({
    locator: ProSettings.description,
    options: { maxWaitMs: PRESENT_MAX_WAIT, text: tStripped('proRefundDescription') },
  });
}

/**
 * Assert the page took one route and not the other two.
 *
 * Presence alone would pass an app rendering all three, and the routes are otherwise
 * indistinguishable — same hero, same button id — so the absences are the assertion.
 */
async function expectRefundRoute(
  alice: DesktopWrapper,
  route: StrategyExtractionObj,
  bodyText: string,
  buttonText: string
): Promise<void> {
  await Promise.all([
    alice.waitForElement({
      locator: route,
      options: { maxWaitMs: PRESENT_MAX_WAIT, text: bodyText },
    }),
    alice.waitForElement({
      locator: ProNonOriginating.platformButton,
      options: { maxWaitMs: PRESENT_MAX_WAIT, text: buttonText },
    }),
  ]);
  await Promise.all(
    REFUND_ROUTES.filter(other => other.selector !== route.selector).map(other =>
      alice.hasElementPoppedUpThatShouldnt(other)
    )
  );
}

/**
 * Press the route's button and assert the "Open URL" confirmation it raises offers a URL naming
 * `urlFragment` — i.e. that the page *takes* the route its copy *describes*.
 *
 * Worth having on top of the copy assertions above because the two are independent: `ProPageButtonRefund`
 * decides the label and the URL from the same `isPlatformRefundAvailable`, but it decides them in two
 * separate expressions, so one can be changed without the other.
 *
 * A fragment, not the whole URL — see `REFUND_URL_FRAGMENT`. Desktop's selector builder appends
 * Playwright's `:has-text()`, which is already a substring match, so the fragment goes straight in as
 * `text`.
 *
 * `Global.modalDescription` is the generic modal-body id rather than a dialog-specific one, because
 * `OpenUrlModal.tsx` carries no `open-url-description` (the mobile clients now do). `openUrlButton` is
 * asserted alongside it so the pair names the dialog being read.
 */
async function expectRefundOpensUrl(alice: DesktopWrapper, urlFragment: string): Promise<void> {
  await alice.clickOn(ProNonOriginating.platformButton);
  await alice.waitForElement({
    locator: Global.openUrlButton,
    options: { maxWaitMs: PRESENT_MAX_WAIT },
  });
  await alice.waitForElement({
    locator: Global.modalDescription,
    options: { maxWaitMs: PRESENT_MAX_WAIT, text: urlFragment },
  });
}

/**
 * A Google Play plan whose refund window is still open: the store handles the refund under its own
 * policies, and the button leaves for the store's website.
 */
test_Alice_1W_no_network(
  'Pro refund route (Google Play, window open)',
  async ({ alice }) => {
    await openRefundPage(alice);
    await expectRefundRoute(
      alice,
      ProNonOriginating.refundStorePolicies,
      tStripped('proImportantDescription'),
      tStripped('openPlatformWebsite', {
        platform: tStripped('pro_provider_google_play_store'),
      })
    );
    await expectRefundOpensUrl(alice, REFUND_URL_FRAGMENT.quickRefund);
  },
  {
    pro: {
      proBackendStatus: 'active',
      proProof: 'valid',
      proLoadingState: 'success',
      proOriginatingPlatform: 'android',
      proQuickRefundWindow: 'open',
    },
  }
);

/**
 * The same plan once the store's window has closed. The store will no longer take the request, so the
 * route becomes Session Support and the button stops being an outbound link to a store.
 */
test_Alice_1W_no_network(
  'Pro refund route (Google Play, window closed)',
  async ({ alice }) => {
    await openRefundPage(alice);
    await expectRefundRoute(
      alice,
      ProNonOriginating.refundSessionSupport,
      tStripped('proImportantDescription'),
      tStripped('requestRefund')
    );
    // The pair with the case above, and the assertion the window mock exists for: Google Play is the one
    // provider whose two refund URLs differ, so this fragment and that one are the whole difference.
    await expectRefundOpensUrl(alice, REFUND_URL_FRAGMENT.sessionProSupportForm);
  },
  {
    pro: {
      proBackendStatus: 'active',
      proProof: 'valid',
      proLoadingState: 'success',
      proOriginatingPlatform: 'android',
      proQuickRefundWindow: 'closed',
    },
  }
);

/**
 * An App Store plan, whose refund window runs for the whole subscription and so is open for any active
 * plan. Apple ties the refund to the account that bought it, so this route names that account and the
 * device it is signed in on — where the other two only ever talk about a store or about Session.
 */
test_Alice_1W_no_network(
  'Pro refund route (Apple App Store)',
  async ({ alice }) => {
    await openRefundPage(alice);
    await expectRefundRoute(
      alice,
      ProNonOriginating.refundPlatformAccount,
      tStripped('proPlanPlatformRefund', {
        platform_store: tStripped('pro_provider_app_store_store'),
        platform_account: tStripped('pro_provider_app_store_account'),
      }),
      tStripped('openPlatformWebsite', {
        platform: tStripped('pro_provider_app_store_platform'),
      })
    );
    await alice.waitForElement({
      locator: ProNonOriginating.refundPlatformAccount,
      options: {
        maxWaitMs: PRESENT_MAX_WAIT,
        text: tStripped('requestRefundPlatformWebsite', {
          platform: tStripped('pro_provider_app_store_platform'),
          platform_account: tStripped('pro_provider_app_store_account'),
        }),
      },
    });
    // Apple's `refund_platform_url` and `refund_support_url` are the same page, so this fragment cannot
    // tell the window-open route from the window-closed one. It is here to prove the button opens the
    // confirmation at all and points at Apple rather than at Session Support — which the other two
    // absences above do not cover, because they are about the page, not about where the button goes.
    await expectRefundOpensUrl(alice, REFUND_URL_FRAGMENT.quickRefund);
  },
  {
    pro: {
      proBackendStatus: 'active',
      proProof: 'valid',
      proLoadingState: 'success',
      proOriginatingPlatform: 'iOS',
      proQuickRefundWindow: 'open',
    },
  }
);
