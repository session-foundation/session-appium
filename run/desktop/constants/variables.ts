// Only the types import path was rewritten to the desktop `../types`.

import {
  DisappearActions,
  DisappearGroupType,
  DisappearType,
  DMTimeOption,
  MediaType,
} from '../types';

export { longText } from '../../shared/constants';
export const screenshotFolder = 'screenshots';
export { testLink } from '../../shared/constants';
export const testLinkTitle = 'Session | Send Messages, Not Metadata. | Private Messenger';

export const mediaArray = [
  {
    mediaType: 'image',
    path: 'sample_files/test-image.png',
    attachmentType: 'media' as MediaType,
    shouldCheckMediaPreview: true,
  },
  {
    mediaType: 'video',
    path: 'sample_files/test-video.mp4',
    attachmentType: 'media' as MediaType,
    shouldCheckMediaPreview: true,
  },
  {
    mediaType: 'gif',
    path: 'sample_files/test-gif.gif',
    attachmentType: 'media' as MediaType,
    shouldCheckMediaPreview: true,
  },
  {
    mediaType: 'document',
    path: 'sample_files/test-file.pdf',
    attachmentType: 'file' as MediaType,
    shouldCheckMediaPreview: false,
  },
  {
    mediaType: 'voice',
    path: '',
    attachmentType: 'audio' as MediaType,
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
