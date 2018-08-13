import aws from 'aws-sdk'

import config from 'infrastructure/config'

export default new aws.S3({
  region: config.aws.s3.region,
  accessKeyId: config.aws.s3.accessKeyId,
  secretAccessKey: config.aws.s3.secretAccessKey
})
