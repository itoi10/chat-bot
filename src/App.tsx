import React, { useState, useEffect, useCallback } from "react";
import "./assets/styles/style.scss";
import { AnswersList, Chats, FormDialog } from "./components/index";
import defaultDataset from "./data/dataset.json";
import { firestore } from "./firebase/index";

// １つのチャット
export interface ChatsContent {
  text: string;
  type: "question" | "answer";
}
// １つの回答
export interface AnswersContent {
  content: string;
  nextId: string;
}
// １つのデータセット
export interface Dataset {
  answers: AnswersContent[];
  question: string;
}

const App: React.FC = () => {
  // 回答コンポーネントに表示するデータ
  const [answers, setAnswers] = useState<AnswersContent[]>([]);
  // チャットコンポーネントに表示するデータ
  const [chats, setChats] = useState<ChatsContent[]>([]);
  // 現在の質問ID
  const [currentId, setCurrentId] = useState<string>("init");
  // 質問と回答のデータセット
  const [dataset, setDataset] = useState<{ [key: string]: Dataset }>({});
  // 問い合わせフォーム用モーダルの開閉
  const [open, setOpen] = useState<boolean>(false);
  // 回答ボタン無効
  const [disabledAnswer, setDisabledAnswer] = useState<boolean>(false);

  // データをfirestoreから取得するか
  const fetchFireStore = false;

  // お問い合わせモーダルを開く
  const handleClickOpen = () => {
    setOpen(true);
  };
  // モーダルを閉じる。propsでモーダルに渡される
  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  // 回答選択, propsで各選択肢のonClickに渡される
  const selectAnswer = useCallback(
    (answer: AnswersContent) => {
      const selectedAnswer = answer.content;
      const nextQuestionId = answer.nextId;

      switch (true) {
        // お問い合わせモーダルを開く
        case nextQuestionId === "contact":
          handleClickOpen();
          break;
        // nextIdがhttp〜ならリンクを開く
        case /^https?:*/.test(nextQuestionId):
          const a = document.createElement("a");
          a.href = nextQuestionId;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.click();
          break;
        // nextIdがweather:なら天気を取得して表示
        case /^weather:*/.test(nextQuestionId):
          addChats({ text: selectedAnswer, type: "answer" });
          (async () => {
            setDisabledAnswer(true);
            // weather:地域名:地域コード
            const [_, areaName, areaCode] = nextQuestionId.split(":");
            const message = await fetchWeather(areaName, areaCode);
            setTimeout(() => {
              addChats({ text: message, type: "question" });
              setDisabledAnswer(false);
            }, 300);
          })();
          break;
        // 一般的な回答
        default:
          addChats({ text: selectedAnswer, type: "answer" });
          // 少し待ってから次の質問を表示。その間回答ボタンは無効化する
          setDisabledAnswer(true);
          setTimeout(() => {
            displayNextQuestion(nextQuestionId, dataset[nextQuestionId]);
            setDisabledAnswer(false);
          }, 500);
      }
    },
    [answers]
  );

  // 最初の処理
  useEffect(() => {
    // firestoreから取得する
    if (fetchFireStore) {
      // 読み込みを待ってから次の処理に行く
      (async () => {
        try {
          const initDataset: { [key: string]: Dataset } = {};
          await firestore
            .collection("questions")
            .get()
            .then((snapshots) => {
              snapshots.forEach((doc) => {
                initDataset[doc.id] = doc.data() as Dataset;
              });
            });
          setDataset(initDataset);
          // 最初の質問表示
          displayNextQuestion(currentId, initDataset[currentId]);
          console.log("success firestore");
        } catch (e) {
          // firestoreから取得失敗したらファイルから取得する
          console.log(e);
          setDataset(defaultDataset as {});
          displayNextQuestion(currentId, defaultDataset["init"]);
        }
      })();
    }
    // ファイルから取得する
    else {
      setDataset(defaultDataset as {});
      displayNextQuestion(currentId, defaultDataset["init"]);
    }
  }, []);

  // 天気を取得する
  const fetchWeather = async (areaName: string, areaCode: string) => {
    try {
      const res = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${areaCode}.json`);
      const data = await res.json();
      const ret = data["0"]["timeSeries"]["0"]["areas"]["0"]["weathers"]["0"];
      const message = areaName + "の天気は" + ret + "です。";
      return message;
    } catch {
      return "天気の取得に失敗しました。";
    }
  };

  // 毎回の処理
  useEffect(() => {
    // 一番下にスクロール
    const scrollArea = document.getElementById("scroll-area");
    if (scrollArea) {
      scrollArea.scrollTo({
        top: scrollArea.scrollHeight,
        behavior: "smooth",
      });
    }
  });

  // 次の質問を表示
  const displayNextQuestion = (nextQuestionId: string, nextDataset: Dataset) => {
    addChats({ text: nextDataset.question, type: "question" });
    setAnswers(nextDataset.answers);
    setCurrentId(nextQuestionId);
  };

  // 新しいチャットを追加
  const addChats = (chat: ChatsContent) => {
    setChats((prevChats) => {
      return [...prevChats, chat];
    });
  };

  return (
    <section className="c-section">
      <div className="c-box">
        <Chats chats={chats} />
        <AnswersList answers={answers} disabled={disabledAnswer} select={selectAnswer} />
        <FormDialog open={open} handleClose={handleClose} />
      </div>
    </section>
  );
};

export default App;
