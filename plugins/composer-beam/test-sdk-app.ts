interface ComposerCustomization {
  id: string;
  actions?: unknown;
  banners?: unknown;
}

interface TestPluginAppDefinition {
  composerCustomizations: ComposerCustomization[];
  composer: {
    customize(registration: ComposerCustomization): void;
  };
}

const definition: TestPluginAppDefinition = {
  composerCustomizations: [],
  composer: {
    customize(registration) {
      definition.composerCustomizations.push(registration);
    },
  },
};

export function definePluginApp(
  setup: (app: TestPluginAppDefinition) => void,
): TestPluginAppDefinition {
  definition.composerCustomizations.length = 0;
  setup(definition);
  return definition;
}

export function useComposerView(): never {
  throw new Error("useComposerView is not used by this test surface");
}
