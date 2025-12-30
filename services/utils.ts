/**
 * Compresses an image file to a maximum dimension of 1080px and JPEG quality 0.7.
 * This ensures images are optimized for mobile viewing.
 */
export const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target?.result as string;
        };

        reader.onerror = (err) => reject(err);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }

            // Max dimension logic
            const MAX_SIZE = 1080;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Compression failed'));
                    return;
                }
                // Create a new file with the compressed blob
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                });
                resolve(compressedFile);
            }, 'image/jpeg', 0.7); // 70% quality
        };
        
        reader.readAsDataURL(file);
    });
};