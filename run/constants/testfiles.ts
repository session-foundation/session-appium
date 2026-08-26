/**
 * The single media set, shared by every platform. Desktop points at these paths directly;
 * mobile either pushes them to the device or has them preloaded into the simulator image by
 * `scripts/create_ios_simulators.ts`. Relative to the repo root, which is the test cwd.
 */
export const mediaFolder = 'sample_files';

export const testImage = 'test_image.jpg';
export const testFile = 'test_file.pdf';
export const testVideo = 'test_video.mp4';
export const testVideoThumbnail = 'test_video_thumbnail.png';
export const profilePicture = 'profile_picture.jpg';
export const animatedProfilePicture = 'animated_profile_picture.gif';
