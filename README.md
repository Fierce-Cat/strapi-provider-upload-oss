# @fiercecat/strapi-provider-upload-oss

## Configurations

Your configuration is passed down to the provider. (e.g: `new AWS.S3(config)`). You can see the complete list of options [here](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property)

See the [using a provider](https://docs.strapi.io/developer-docs/latest/plugins/upload.html#using-a-provider) documentation for information on installing and using a provider. And see the [environment variables](https://docs.strapi.io/developer-docs/latest/setup-deployment-guides/configurations/optional/environment.html#environment-variables) for setting and using environment variables in your configs.

**Example**

`./config/plugins.js`

```js
module.exports = ({ env }) => ({
  // ...
  upload: {
      enabled: true,
      config: {
          provider: 'strapi-provider-upload-oss',
          providerOptions: {
          baseUrl: env('OSS_BASE_URL'),
          accessKeyId: env('OSS_ACCESS_KEY_ID'),
          secretAccessKey: env('OSS_ACCESS_SECRET'),
          endpoint: env('OSS_ENDPOINT'),
          params: {
              Bucket: env('OSS_BUCKET'),
        },
      },
    },
  },
  // ...
});
```

## Required AWS Policy Actions

These are the minimum amount of permissions needed for this provider to work.

```
"Action": [
  "s3:PutObject",
  "s3:GetObject",
  "s3:ListBucket",
  "s3:DeleteObject",
  "s3:PutObjectAcl"
],
```

## Resources

- [License](LICENSE)

## Links

- [Strapi website](https://strapi.io/)
- [Strapi community on Slack](https://slack.strapi.io)
- [Strapi news on Twitter](https://twitter.com/strapijs)
