import { Raw } from "../jsx/jsx-runtime";
import { cssText } from "../css-text";
import baseStyles from "../styles/base.module.css";
import uploadStyles from "../styles/upload.module.css";
import { getClientJs } from "../client-bundle";

type UploadPageProps = {
  token: string;
  baseUrl: string;
};

export function uploadPage({ token, baseUrl }: UploadPageProps): string {
  const pageData = JSON.stringify({
    token,
    baseUrl,
    styles: {
      dropZone: uploadStyles.dropZone,
      dropZoneActive: uploadStyles.dropZoneActive,
      fileList: uploadStyles.fileList,
      fileItem: uploadStyles.fileItem,
      fileHeader: uploadStyles.fileHeader,
      fileName: uploadStyles.fileName,
      fileSize: uploadStyles.fileSize,
      fileStatus: uploadStyles.fileStatus,
      statusPending: uploadStyles.statusPending,
      statusUploading: uploadStyles.statusUploading,
      statusComplete: uploadStyles.statusComplete,
      statusError: uploadStyles.statusError,
      progressTrack: uploadStyles.progressTrack,
      progressBar: uploadStyles.progressBar,
      fileUrl: uploadStyles.fileUrl,
      fileUrlText: uploadStyles.fileUrlText,
      copyBtn: uploadStyles.copyBtn,
      errorMsg: uploadStyles.errorMsg,
      hidden: uploadStyles.hidden,
    },
  });

  return "<!DOCTYPE html>" + (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Upload Files — ClawdFiles</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=optional" />
        <style><Raw html={cssText(baseStyles, "base") + cssText(uploadStyles, "upload")} /></style>
        <script type="application/json" id="pageData"><Raw html={pageData} /></script>
      </head>
      <body>
        <div class={uploadStyles.page}>
          <div class={uploadStyles.container}>
            <div class={uploadStyles.title}>Upload Files</div>
            <div class={uploadStyles.dropZone} id="dropZone">
              <div class={uploadStyles.dropIcon}>&#8593;</div>
              <div class={uploadStyles.dropText}>Drag and drop files here</div>
              <button class={uploadStyles.browseBtn} id="browseBtn">Choose Files</button>
              <div class={uploadStyles.dropHint}>Files upload immediately when dropped</div>
              <input type="file" id="fileInput" multiple class={uploadStyles.hidden} />
            </div>
            <div class={uploadStyles.fileList} id="fileList"></div>
          </div>
        </div>
        <script><Raw html={getClientJs("upload")} /></script>
      </body>
    </html>
  );
}
