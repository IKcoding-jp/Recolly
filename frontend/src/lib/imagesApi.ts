import { request } from './api'
import type { PresignResponse, ImageResponse } from './types'

export const imagesApi = {
  // 署名付きURL発行（S3アップロード用の一時的な合鍵を取得）
  presign(fileName: string, contentType: string, fileSize: number): Promise<PresignResponse> {
    return request<PresignResponse>('/images/presign', {
      method: 'POST',
      body: JSON.stringify({
        image: { file_name: fileName, content_type: contentType, file_size: fileSize },
      }),
    })
  },

  // メタデータ登録（S3アップロード完了後にDBに記録）
  create(params: {
    s3Key: string
    fileName: string
    contentType: string
    fileSize: number
    imageableType: string
    imageableId: number
  }): Promise<ImageResponse> {
    return request<ImageResponse>('/images', {
      method: 'POST',
      body: JSON.stringify({
        image: {
          s3_key: params.s3Key,
          file_name: params.fileName,
          content_type: params.contentType,
          file_size: params.fileSize,
          imageable_type: params.imageableType,
          imageable_id: params.imageableId,
        },
      }),
    })
  },

  // 画像削除
  destroy(id: number): Promise<void> {
    return request<void>(`/images/${id}`, { method: 'DELETE' })
  },

  // S3に直接アップロード（XHRでプログレスバー対応）
  // fetchにはアップロード進捗を取得する機能がないため、XHRを使用する
  uploadToS3(
    presignedUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`S3アップロードに失敗しました: ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('ネットワークエラーが発生しました'))
      xhr.send(file)
    })
  },
}
