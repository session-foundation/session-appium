// Only the types import path was rewritten to the desktop `../types`.

import {
  AttachmentType,
  DisappearActions,
  DisappearGroupType,
  DisappearType,
  DMTimeOption,
} from '../types';

export { longText } from '../../shared/constants';
export const screenshotFolder = 'screenshots';
export { testLink } from '../../shared/constants';
export const testLinkTitle = 'Session | Send Messages, Not Metadata. | Private Messenger';

/** One row per media fixture the Desktop specs send. */
type MediaFixture = {
  mediaType: string;
  path: string;
  /** What the download prompt calls it — see [AttachmentType]. Not the same as `mediaType`. */
  attachmentType: AttachmentType;
  shouldCheckMediaPreview: boolean;
};

export const mediaArray: Array<MediaFixture> = [
  {
    mediaType: 'image',
    path: 'sample_files/test-image.png',
    attachmentType: 'media',
    shouldCheckMediaPreview: true,
  },
  {
    mediaType: 'video',
    path: 'sample_files/test-video.mp4',
    attachmentType: 'media',
    shouldCheckMediaPreview: true,
  },
  {
    mediaType: 'gif',
    path: 'sample_files/test-gif.gif',
    attachmentType: 'media',
    shouldCheckMediaPreview: true,
  },
  {
    mediaType: 'document',
    path: 'sample_files/test-file.pdf',
    attachmentType: 'file',
    shouldCheckMediaPreview: false,
  },
  {
    mediaType: 'voice',
    path: '',
    attachmentType: 'audio',
    shouldCheckMediaPreview: false,
  },
];

type DisappearingOption = {
  timeOption: DMTimeOption;
  disappearingMessagesType: DisappearGroupType | DisappearType;
  disappearAction: DisappearActions;
};

export const defaultDisappearingOptions = {
  DAS: {
    timeOption: 'time-option-30-seconds',
    disappearingMessagesType: 'disappear-after-send-option',
    disappearAction: 'sent',
  },
  DAR: {
    timeOption: 'time-option-10-seconds',
    disappearingMessagesType: 'disappear-after-read-option',
    disappearAction: 'read',
  },
  group: {
    timeOption: 'time-option-10-seconds',
    disappearingMessagesType: 'disappear-after-send-option' satisfies DisappearGroupType,
    disappearAction: 'sent',
  },
  NTS: {
    timeOption: 'time-option-10-seconds',
    disappearingMessagesType: 'disappear-after-send-option',
    disappearAction: 'sent',
  },
} as const satisfies Record<string, DisappearingOption>;
