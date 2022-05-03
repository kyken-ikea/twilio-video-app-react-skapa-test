import React, { useCallback, useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { TwilioCaptionResult } from './CaptionTypes';
import { Typography } from '@material-ui/core';
import useParticipants from '../../hooks/useParticipants/useParticipants';
import useTracks from '../../hooks/useTracks/useTracks';
import { useAppState } from '../../state';

interface Caption {
  identity: string;
  id: string;
  timestamp: number;
  transcript: string;
}

const useStyles = makeStyles({
  captionContainer: {
    position: 'fixed',
    left: '15%',
    right: '15%',
    top: 'calc(100% - 300px)',
    zIndex: 100,
  },
  caption: {
    color: 'white',
    background: 'rgba(0, 0, 0, 0.8)',
    padding: '0.2em',
    display: 'inline-block',
  },
});

export function CaptionRenderer() {
  const classes = useStyles();
  const [captions, setCaptions] = useState<Caption[]>([]);
  const participants = useParticipants();
  const transcriberParticipant = participants.find(p => p.identity === 'media-transcriber');
  const transcriberTracks = useTracks(transcriberParticipant);
  const transcriberDataTrack = transcriberTracks.find(track => track.kind === 'data');
  const { displayCaptions } = useAppState();

  const registerResult = useCallback((result: TwilioCaptionResult) => {
    if (result.transcriptionResponse.TranscriptEvent.Transcript.Results.length) {
      const transcript = result.transcriptionResponse.TranscriptEvent.Transcript.Results[0].Alternatives[0].Transcript;
      const id = result.transcriptionResponse.TranscriptEvent.Transcript.Results[0].ResultId;
      const timestamp = Date.now();
      const identity = result.participantIdentity;

      setCaptions(prevCaptions => {
        // Make a copy of the caption array, keeping only the 4 most recent captions
        const arrayCopy = prevCaptions.slice(-4);

        const existingID = arrayCopy.find(item => item.id === id);
        if (existingID) {
          const existingIdIndex = arrayCopy.indexOf(existingID);
          arrayCopy[existingIdIndex] = { transcript, id, timestamp, identity };
        }
        // else if (/* the last transcript has the same identity */){
        //     /* append to that transcription instead of creating a new one */
        // }
        else {
          arrayCopy.push({ transcript, id, timestamp, identity });
        }

        return arrayCopy;
      });
    }
  }, []);

  useEffect(() => {
    if (transcriberDataTrack) {
      const handleMessage = (message: string) => {
        try {
          registerResult(JSON.parse(message));
        } catch (e) {
          console.log('received unexpected dataTrack message: ', message);
        }
      };
      transcriberDataTrack.on('message', handleMessage);

      return () => {
        transcriberDataTrack.on('message', handleMessage);
      };
    }
  }, [transcriberDataTrack, registerResult]);

  // Every second, we go through the captions, and remove any that are older than ten seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCaptions(prevCaptions => {
        const now = Date.now();
        const filteredCaptions = prevCaptions.filter(caption => caption.timestamp > now - 10000);
        if (filteredCaptions.length !== prevCaptions.length) {
          return filteredCaptions;
        } else {
          return prevCaptions;
        }
      });
    }, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  if (!displayCaptions) return null;

  return (
    <div className={classes.captionContainer}>
      {captions.map(caption => (
        <div>
          <Typography variant="h6" key={caption.id} className={classes.caption}>
            {caption.identity}: {caption.transcript}
          </Typography>
        </div>
      ))}
    </div>
  );
}