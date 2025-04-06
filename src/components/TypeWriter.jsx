import { useState, useEffect, useRef } from 'react';

const TypeWriter = ({ text, speed = 20, className = '' }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const isMounted = useRef(true);
  const fullTextRef = useRef(text);
  
  // Update reference when text changes
  useEffect(() => {
    const oldText = fullTextRef.current;
    fullTextRef.current = text;
    
    // If text is being appended, don't reset the animation
    if (text.startsWith(oldText) && oldText.length > 0) {
      setCurrentIndex(oldText.length);
      setDisplayedText(oldText);
    } else if (text !== oldText) {
      // Complete reset for new text
      setCurrentIndex(0);
      setDisplayedText('');
    }
  }, [text]);
  
  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Typing animation effect
  useEffect(() => {
    if (currentIndex < fullTextRef.current.length) {
      let currentSpeed = speed;
      const currentChar = fullTextRef.current[currentIndex];
      
      // Speed variations for different characters
      if (currentChar === '\n') currentSpeed = speed * 1.5;
      if (currentChar === '.') currentSpeed = speed * 3;
      if (currentChar === '!') currentSpeed = speed * 3;
      if (currentChar === '>') currentSpeed = speed * 2;
      
      // Add some randomness for realism
      const variance = Math.random() * 10 - 5;
      currentSpeed = Math.max(5, currentSpeed + variance);
      
      const timeout = setTimeout(() => {
        if (isMounted.current) {
          setDisplayedText(prev => prev + currentChar);
          setCurrentIndex(prevIndex => prevIndex + 1);
        }
      }, currentSpeed);
      
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, speed]);
  
  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      if (isMounted.current) {
        setShowCursor(prev => !prev);
      }
    }, 530);
    
    return () => clearInterval(cursorInterval);
  }, []);
  
  return (
    <span className={className}>
      {displayedText}
      {showCursor && currentIndex < fullTextRef.current.length && 
        <span className="typewriter-cursor"></span>}
    </span>
  );
};

export default TypeWriter;