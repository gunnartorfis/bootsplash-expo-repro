/* eslint-disable @typescript-eslint/no-var-requires */
const {
  withAndroidManifest,
  withMainActivity,
  withAppDelegate,
  withAndroidStyles,
  AndroidConfig,
} = require("@expo/config-plugins");

const withAdyenAndroid = (config) => {
  const configWithStyles = withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(
      config.modResults,
      {
        add: true,
        parent: {
          name: "AdyenCheckout",
          parent: "Adyen",
        },
        name: "colorPrimary",
        value: "#286EFA",
      }
    );

    config.modResults.resources.style = config.modResults.resources.style.map(
      (s) => {
        if (s["$"] && s["$"].name === "AppTheme") {
          return {
            ...s,
            ["$"]: {
              name: "AppTheme",
              parent: "Theme.MaterialComponents.DayNight.NoActionBar",
            },
          };
        }
        return s;
      }
    );

    return config;
  });

  const configWithMainActivity = withMainActivity(
    configWithStyles,
    async (newConfig) => {
      const mainActivity = newConfig.modResults;
      mainActivity.contents = mainActivity.contents.replace(
        "class MainActivity : ReactActivity() {",
        "import android.content.Intent;\nimport com.adyenreactnativesdk.AdyenCheckout;\n\nclass MainActivity : ReactActivity() {"
      );

      const onActivityResult = `
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    AdyenCheckout.handleActivityResult(requestCode, resultCode, data)
  }`;

      mainActivity.contents = mainActivity.contents.replace(
        "super.onCreate(null)",
        "super.onCreate(null);\n    AdyenCheckout.setLauncherActivity(this);"
      );

      mainActivity.contents = mainActivity.contents.replace(
        "AdyenCheckout.setLauncherActivity(this);\n  }",
        `AdyenCheckout.setLauncherActivity(this);\n  }\n${onActivityResult}`
      );

      return newConfig;
    }
  );

  const configWithManifest = withAndroidManifest(
    configWithMainActivity,
    async (newConfig) => {
      const mainActivity = newConfig.modResults;
      // Add com.adyenreactnativesdk.component.dropin.AdyenCheckoutService service
      // after com.facebook.react.HeadlessJsTaskService
      mainActivity.manifest.application = [
        // @ts-expect-error - manifest is not well typed
        {
          ...mainActivity.manifest.application?.[0],
          service: [
            {
              $: {
                "android:name":
                  "com.adyenreactnativesdk.component.dropin.AdyenCheckoutService",
                "android:exported": "false",
              },
            },
          ],
        },
      ];
      return newConfig;
    }
  );

  return configWithManifest;
};

const withAdyenIos = (config, iosFramework) => {
  const importLine =
    iosFramework === "static"
      ? "#import <adyen_react_native/ADYRedirectComponent.h>"
      : "#import <adyen-react-native/ADYRedirectComponent.h>";
  const appDelegate = withAppDelegate(config, async (newConfig) => {
    const appDelegateModResults = newConfig.modResults;
    appDelegateModResults.contents = appDelegateModResults.contents.replace(
      '#import "AppDelegate.h"\n\n',
      `#import "AppDelegate.h"\n\n${importLine}\n`
    );
    appDelegateModResults.contents = appDelegateModResults.contents.replace(
      /\/\/ Linking API.*\n.*\n.*\n}/g,
      `// Linking API
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
  // Adyen SDK
  return [ADYRedirectComponent applicationDidOpenURL:url];
}`
    );
    return newConfig;
  });
  return appDelegate;
};

module.exports = function (config, iosFramework = "dynamic") {
  return withAdyenIos(withAdyenAndroid(config), iosFramework);
};
