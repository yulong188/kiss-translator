import Alert from "@mui/material/Alert";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiDict } from "../../apis";
import { useI18n } from "../../hooks/I18n";
import CopyBtn from "./CopyBtn";

const pendingRequests = new Map();

function getRequestKey({ text, fromLang, apiSettingKey, context }) {
  return JSON.stringify({ text, fromLang, apiSettingKey, context });
}

/**
 * 划词框中的外贸英语学习卡。
 * 无论输入中英文，都要求模型围绕英文表达解释缩写、组成和外贸用法。
 */
export default function TradeTermCont({
  text,
  fromLang = "auto",
  apiSetting,
  context = "",
}) {
  const i18n = useI18n();
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiSettingKey = useMemo(
    () => JSON.stringify(apiSetting || {}),
    [apiSetting]
  );

  useEffect(() => {
    if (!text?.trim() || !apiSetting?.apiSlug || !apiSetting?.dictPrompt) {
      setMarkdown("");
      setLoading(false);
      setError("");
      return;
    }

    let active = true;
    const requestKey = getRequestKey({
      text,
      fromLang,
      apiSettingKey,
      context,
    });
    let streamRenderTimer = null;
    let latestStreamMarkdown = "";
    let hasRenderedFirstChunk = false;
    const handleStreamChunk = ({ markdown: chunkMarkdown }) => {
      if (!active || !chunkMarkdown) return;

      latestStreamMarkdown = chunkMarkdown;
      // 首个可读分片立即上屏；后续小分片合并刷新，避免每个 token
      // 都重新解析和渲染整张 Markdown 卡片。
      if (!hasRenderedFirstChunk) {
        hasRenderedFirstChunk = true;
        setMarkdown(chunkMarkdown);
        setLoading(false);
        return;
      }

      if (!streamRenderTimer) {
        streamRenderTimer = setTimeout(() => {
          streamRenderTimer = null;
          if (active) setMarkdown(latestStreamMarkdown);
        }, 50);
      }
    };

    (async () => {
      try {
        setLoading(true);
        setMarkdown("");
        setError("");

        let pending = pendingRequests.get(requestKey);
        if (!pending) {
          pending = {
            subscribers: new Set(),
            promise: null,
            latestMarkdown: "",
          };
          pending.subscribers.add(handleStreamChunk);
          pendingRequests.set(requestKey, pending);
          pending.promise = apiDict({
            text,
            fromLang,
            toLang: "zh-CN",
            apiSetting,
            context,
            onStreamChunk: (chunk) => {
              pending.latestMarkdown = chunk.markdown || "";
              pending.subscribers.forEach((subscriber) => subscriber(chunk));
            },
          }).finally(() => pendingRequests.delete(requestKey));
        } else {
          pending.subscribers.add(handleStreamChunk);
          if (pending.latestMarkdown) {
            handleStreamChunk({ markdown: pending.latestMarkdown });
          }
        }

        const result = await pending.promise;
        if (active) {
          clearTimeout(streamRenderTimer);
          streamRenderTimer = null;
          setMarkdown(result);
        }
      } catch (err) {
        if (err?.name !== "AbortError" && active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      clearTimeout(streamRenderTimer);
      const pending = pendingRequests.get(requestKey);
      pending?.subscribers.delete(handleStreamChunk);
    };
  }, [text, fromLang, apiSetting, apiSettingKey, context]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderColor: "primary.main",
        bgcolor: "action.hover",
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <AutoStoriesOutlinedIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={700}>
            {i18n("trade_term_learning")}
          </Typography>
          {loading && !markdown && <CircularProgress size={12} />}
        </Stack>
        <CopyBtn text={markdown} title={i18n("copy")} />
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {error}
        </Alert>
      ) : !markdown ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {loading ? i18n("trade_term_loading") : null}
        </Typography>
      ) : (
        <Box
          sx={{
            mt: 1,
            "& > :first-of-type": { mt: 0 },
            "& > :last-child": { mb: 0 },
            "& h1, & h2, & h3, & h4": {
              fontSize: "0.95rem",
              fontWeight: 700,
              mt: 1.25,
              mb: 0.5,
            },
            "& p": { my: 0.75 },
            "& ul, & ol": { pl: 2.5, my: 0.75 },
            "& li": { mb: 0.35 },
            "& code": {
              px: 0.5,
              py: 0.1,
              borderRadius: 0.5,
              bgcolor: "background.paper",
              color: "primary.main",
              fontWeight: 700,
            },
          }}
        >
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </Box>
      )}
    </Paper>
  );
}
