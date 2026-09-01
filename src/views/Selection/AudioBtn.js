import IconButton from "@mui/material/IconButton";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useState } from "react";
import { useAudio } from "../../hooks/Audio";
import {
  canSpeak,
  pauseSpeech,
  resolveSpeechLanguage,
  resumeSpeech,
  speak,
  stopSpeech,
} from "../../libs/speech";
import { useI18n } from "../../hooks/I18n";
import queryString from "query-string";

/**
 * 基础发音/音频播放按钮组件
 *
 * @param {Object} props
 * @param {string} props.src - 音频源的 URL 地址
 */
export function AudioBtn({ src }) {
  // 使用自定义的 useAudio 控制音频加载与播放状态
  const { error, ready, playing, onPlay } = useAudio(src);

  // 如果加载音频出错或音频尚未准备就绪，显示禁用的发音图标
  if (error || !ready) {
    return (
      <IconButton disabled size="small">
        <VolumeUpIcon fontSize="inherit" />
      </IconButton>
    );
  }

  // 如果当前音频正在播放，图标高亮为 primary 主题色
  if (playing) {
    return (
      <IconButton color="primary" size="small">
        <VolumeUpIcon fontSize="inherit" />
      </IconButton>
    );
  }

  // 默认正常就绪状态，点击时调用 onPlay 开始播放
  return (
    <IconButton onClick={onPlay} size="small">
      <VolumeUpIcon fontSize="inherit" />
    </IconButton>
  );
}

/**
 * 百度翻译 TTS 发音按钮组件
 *
 * @param {Object} props
 * @param {string} props.text - 需要发音的文本
 * @param {string} [props.lan="uk"] - 语言发音口音配置 (英音 "uk", 美音 "en")
 * @param {number} [props.spd=3] - 语速配置，默认为 3
 */
export function BaiduAudioBtn({ text, lan = "uk", spd = 3 }) {
  if (!text) return null;

  // 拼接百度翻译 TTS 获取语音的公开接口 URL
  const src = `https://fanyi.baidu.com/gettts?${queryString.stringify({ lan, text, spd })}`;
  return <AudioBtn src={src} />;
}

export function BrowserTtsBtn({
  text,
  lang = "auto",
  enabled = true,
  englishAccent = "en-US",
  rate = 1,
  title,
}) {
  const i18n = useI18n();
  const [status, setStatus] = useState("idle");

  if (!enabled || !text?.trim() || !canSpeak()) return null;

  const handleSpeak = () => {
    if (status === "speaking") {
      if (pauseSpeech()) setStatus("paused");
      return;
    }
    if (status === "paused") {
      if (resumeSpeech()) setStatus("speaking");
      return;
    }

    // 新朗读会停止上一处声音，保证原文、译文和学习卡不会同时播放。
    stopSpeech();
    setStatus("speaking");
    const started = speak(
      text,
      resolveSpeechLanguage(text, lang, englishAccent),
      { onEnd: () => setStatus("idle") },
      { rate }
    );

    if (!started) {
      setStatus("idle");
    }
  };

  const dynamicTitle =
    status === "speaking"
      ? i18n("pause_speech", "暂停朗读")
      : status === "paused"
        ? i18n("resume_speech", "继续朗读")
        : title || i18n("speak", "朗读");
  const Icon =
    status === "speaking"
      ? PauseIcon
      : status === "paused"
        ? PlayArrowIcon
        : VolumeUpIcon;

  return (
    <IconButton
      color={status === "idle" ? "default" : "primary"}
      onClick={handleSpeak}
      size="small"
      sx={{ ml: 0.5, verticalAlign: "middle" }}
      title={dynamicTitle}
      aria-label={dynamicTitle}
    >
      <Icon fontSize="inherit" />
    </IconButton>
  );
}
