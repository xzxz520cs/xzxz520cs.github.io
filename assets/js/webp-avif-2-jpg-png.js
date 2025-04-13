let convertedFiles = [];
let totalFiles = 0;
let processedCount = 0;

document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('downloadBtn').addEventListener('click', downloadZip);

async function handleFileSelect(e) {
    const files = e.target.files;
    if (!files.length) return;

    resetState();
    totalFiles = files.length;
    updateStatus(`正在处理 0/${totalFiles} 个文件...`);

    const format = document.getElementById('formatSelect').value;

    for (let file of files) {
        try {
            const convertedData = await convertImage(file, format);
            addPreview(convertedData, file.name);
            convertedFiles.push(convertedData);
        } catch (error) {
            console.error('转换失败:', error);
            updateStatus(`文件 ${file.name} 转换失败: ${error.message}`);
        }
        updateProgress();
    }
}

async function convertImage(file, format) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const img = await loadImage(e.target.result);
                const convertedBlob = await convertImageFormat(img, format);
                resolve({
                    name: file.name.replace(/\.[^.]+$/, `.${format}`),
                    blob: convertedBlob
                });
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error('图片加载失败'));
        img.src = src;
    });
}

function convertImageFormat(img, format) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        canvas.toBlob(blob => resolve(blob), mimeType, format === 'jpg' ? 1 : undefined);
    });
}

function addPreview(data, originalName) {
    const preview = document.createElement('div');
    preview.className = 'card';
    preview.innerHTML = `
        <img src="${URL.createObjectURL(data.blob)}">
        <div>
            <span>${originalName}</span> 
            <span>→</span> 
            <strong>${data.name}</strong>
        </div>
    `;
    document.getElementById('previewContainer').appendChild(preview);
}

function updateProgress() {
    processedCount++;
    const progress = (processedCount / totalFiles) * 100;
    document.querySelector('.progress').style.width = `${progress}%`;
    updateStatus(`正在处理 ${processedCount}/${totalFiles} 个文件...`);

    if (processedCount === totalFiles) {
        updateStatus('转换完成！');
        document.getElementById('downloadBtn').classList.remove('hidden');
    }
}

function updateStatus(text) {
    document.getElementById('status').textContent = text;
}

function resetState() {
    convertedFiles = [];
    processedCount = 0;
    totalFiles = 0;
    document.getElementById('previewContainer').innerHTML = '';
    document.getElementById('downloadBtn').classList.add('hidden');
    document.querySelector('.progress').style.width = '0%';
}

async function downloadZip() {
    const zip = new JSZip();
    const format = document.getElementById('formatSelect').value;
    const folder = zip.folder(`converted_${format}`);

    convertedFiles.forEach(file => {
        folder.file(file.name, file.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `converted_images_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}