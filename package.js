Package.describe({
  summary: "i18next repackaged for Meteor"
});

Package.on_use(function (api) {
  api.add_files('i18next-1.6.3.js', ['client']);
});

